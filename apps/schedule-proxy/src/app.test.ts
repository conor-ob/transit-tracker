import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { WebSocket, WebSocketServer } from "ws";
import { buildApp } from "./app.ts";

const DART = "BRAY-HOWTH-I";
const PEARSE = "8220IR0134";

// 12 trips at Pearse, alternating northbound (0) and southbound (1), as
// upstream would return them for an unfiltered pair
const trips = Array.from({ length: 12 }, (_, i) => ({
  tripId: `trip-${i}`,
  routeId: DART,
  stopId: PEARSE,
  directionId: String(i % 2),
  arrivalTime: 1_800_000_000 + i * 300,
}));

// Stands in for upstream: records what it receives, and answers like it does
class FakeApi {
  server: Server;
  wss: WebSocketServer;
  restRequests: IncomingMessage[] = [];
  wsRequests: IncomingMessage[] = [];
  wsMessages: {
    event: string;
    data: { routeStopPairs: string; limit: number };
  }[] = [];

  constructor() {
    this.server = createServer((request, response) => {
      this.restRequests.push(request);
      const url = new URL(request.url ?? "", "http://localhost");
      const pairs = decodeURIComponent(url.pathname.replace("/schedule/", ""));

      if (
        pairs
          .split(";")
          .some((pair) => Number.isNaN(Number(pair.split(",")[2] ?? 0)))
      ) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            message: "Invalid offset; must be a number",
            error: "Bad Request",
            statusCode: 400,
          }),
        );
        return;
      }

      const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 10);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ trips: trips.slice(0, limit) }));
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on("connection", (socket, request) => {
      this.wsRequests.push(request);
      socket.on("message", (raw) => {
        const message = JSON.parse(raw.toString());
        this.wsMessages.push(message);

        if (message.event === "schedule:subscribe") {
          socket.send(JSON.stringify({ event: "heartbeat", data: null }));
          socket.send(
            JSON.stringify({
              event: "schedule",
              data: { trips: trips.slice(0, message.data.limit) },
            }),
          );
        }
      });
    });
  }

  get url() {
    return `http://localhost:${(this.server.address() as AddressInfo).port}`;
  }

  reset() {
    this.restRequests = [];
    this.wsRequests = [];
    this.wsMessages = [];
  }
}

describe("schedule-proxy", () => {
  const fakeApi = new FakeApi();
  let app: FastifyInstance;
  let proxyUrl: string;

  before(async () => {
    fakeApi.server.listen(0);
    await once(fakeApi.server, "listening");
    app = await buildApp({ apiUrl: fakeApi.url });
    proxyUrl = await app.listen({ host: "127.0.0.1", port: 0 });
  });

  after(async () => {
    await app.close();
    fakeApi.wss.close();
    fakeApi.server.close();
  });

  beforeEach(() => fakeApi.reset());

  // Connects like a Device, subscribes, and collects messages until `count`
  // have arrived
  async function subscribe(data: Record<string, unknown>, count: number) {
    const device = new WebSocket(proxyUrl.replace("http", "ws"), {
      headers: {
        "x-device-id": "device-1",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      },
    });
    const messages: unknown[] = [];
    const done = new Promise<unknown[]>((resolve) => {
      device.on("message", (raw) => {
        messages.push(JSON.parse(raw.toString()));
        if (messages.length === count) resolve(messages);
      });
    });

    await once(device, "open");
    device.send(JSON.stringify({ event: "schedule:subscribe", data }));
    const received = await done;
    device.close();
    return received;
  }

  it("answers its health check", async () => {
    const response = await app.inject("/healthz");
    assert.equal(response.statusCode, 200);
  });

  describe("WebSocket", () => {
    it("sends a Device only southbound trips, up to its own limit", async () => {
      const [heartbeat, schedule] = (await subscribe(
        { routeStopPairs: `${DART},${PEARSE},,1`, limit: 3 },
        2,
      )) as [unknown, { event: string; data: { trips: typeof trips } }];

      assert.deepEqual(heartbeat, { event: "heartbeat", data: null });
      assert.equal(schedule.event, "schedule");
      assert.deepEqual(
        schedule.data.trips.map((trip) => trip.tripId),
        ["trip-1", "trip-3", "trip-5"],
      );
    });

    it("subscribes upstream without Direction filters, at upstream's maximum limit", async () => {
      await subscribe(
        {
          feedCode: "nta",
          routeStopPairs: `${DART},${PEARSE},,1;46A,8220DB000123,-300`,
          limit: 3,
        },
        2,
      );

      assert.deepEqual(fakeApi.wsMessages, [
        {
          event: "schedule:subscribe",
          data: {
            feedCode: "nta",
            routeStopPairs: `${DART},${PEARSE};46A,8220DB000123,-300`,
            limit: 20,
          },
        },
      ]);
    });

    it("returns exactly what upstream does without Direction filters", async () => {
      const [, schedule] = (await subscribe(
        { routeStopPairs: `${DART},${PEARSE}`, limit: 5 },
        2,
      )) as [unknown, { data: { trips: typeof trips } }];

      assert.deepEqual(schedule.data.trips, trips.slice(0, 5));
    });

    it("rejects an invalid Direction without subscribing upstream", async () => {
      const [error] = await subscribe(
        { routeStopPairs: `${DART},${PEARSE},,2`, limit: 3 },
        1,
      );

      assert.deepEqual(error, {
        kind: "invalidInput",
        error: 'Invalid direction "2"; must be 0 or 1',
      });
      assert.deepEqual(fakeApi.wsMessages, []);
    });

    it("leaves an invalid limit for upstream to reject", async () => {
      await subscribe({ routeStopPairs: `${DART},${PEARSE},,1`, limit: 50 }, 2);

      assert.equal(fakeApi.wsMessages[0]?.data.limit, 50);
    });

    it("forwards the headers upstream identifies a Device by", async () => {
      await subscribe({ routeStopPairs: `${DART},${PEARSE}`, limit: 1 }, 2);

      const [request] = fakeApi.wsRequests;
      assert.equal(request?.headers["x-device-id"], "device-1");
      assert.equal(
        request?.headers["x-forwarded-for"],
        "203.0.113.7, 10.0.0.1",
      );
    });
  });

  describe("REST", () => {
    it("returns only southbound trips, up to the requested limit", async () => {
      const response = await app.inject(
        `/schedule/${encodeURIComponent(`${DART},${PEARSE},,1`)}?limit=3`,
      );

      assert.equal(response.statusCode, 200);
      assert.deepEqual(
        response.json().trips.map((trip: { tripId: string }) => trip.tripId),
        ["trip-1", "trip-3", "trip-5"],
      );
    });

    it("asks upstream for its maximum limit without Direction filters", async () => {
      await app.inject(
        `/schedule/${encodeURIComponent(`${DART},${PEARSE},-300,1`)}?limit=3`,
      );

      assert.equal(
        fakeApi.restRequests[0]?.url,
        `/schedule/${encodeURIComponent(`${DART},${PEARSE},-300`)}?limit=10`,
      );
    });

    it("returns exactly what upstream does without Direction filters", async () => {
      const response = await app.inject(
        `/schedule/${encodeURIComponent(`${DART},${PEARSE}`)}?limit=4`,
      );

      assert.deepEqual(response.json(), { trips: trips.slice(0, 4) });
    });

    it("defaults to upstream's limit of 10", async () => {
      const response = await app.inject(
        `/schedule/${encodeURIComponent(`${DART},${PEARSE}`)}`,
      );

      assert.equal(response.json().trips.length, 10);
    });

    it("rejects an invalid Direction as a bad request", async () => {
      const response = await app.inject(
        `/schedule/${encodeURIComponent(`${DART},${PEARSE},,north`)}`,
      );

      assert.equal(response.statusCode, 400);
      assert.equal(
        response.json().message,
        'Invalid direction "north"; must be 0 or 1',
      );
      assert.equal(fakeApi.restRequests.length, 0);
    });

    it("passes upstream errors through unchanged", async () => {
      const response = await app.inject(
        `/schedule/${encodeURIComponent(`${DART},${PEARSE},soon,1`)}`,
      );

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), {
        message: "Invalid offset; must be a number",
        error: "Bad Request",
        statusCode: 400,
      });
    });
  });
});
