import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import { DART, PEARSE, trips, useScheduleProxy } from "~/test/fake-api";

describe("WebSocket schedule", () => {
  const proxy = useScheduleProxy();

  // Connects like a Device, subscribes, and collects messages until `count`
  // have arrived
  async function subscribe(data: Record<string, unknown>, count: number) {
    const device = new WebSocket(proxy.url.replace("http", "ws"), {
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

  it("sends a Device only southbound trips, up to its own limit", async () => {
    const [heartbeat, schedule] = (await subscribe(
      { routeStopPairs: `${DART},${PEARSE},,1`, limit: 3 },
      2,
    )) as [unknown, { event: string; data: { trips: typeof trips } }];

    expect(heartbeat).toEqual({ event: "heartbeat", data: null });
    expect(schedule.event).toBe("schedule");
    expect(schedule.data.trips.map((trip) => trip.tripId)).toEqual([
      "trip-1",
      "trip-3",
      "trip-5",
    ]);
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

    expect(proxy.fakeApi.wsMessages).toEqual([
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

    expect(schedule.data.trips).toEqual(trips.slice(0, 5));
  });

  it("rejects an invalid Direction without subscribing upstream", async () => {
    const [error] = await subscribe(
      { routeStopPairs: `${DART},${PEARSE},,2`, limit: 3 },
      1,
    );

    expect(error).toEqual({
      kind: "invalidInput",
      error: 'Invalid direction "2"; must be 0 or 1',
    });
    expect(proxy.fakeApi.wsMessages).toEqual([]);
  });

  it("leaves an invalid limit for upstream to reject", async () => {
    await subscribe({ routeStopPairs: `${DART},${PEARSE},,1`, limit: 50 }, 2);

    expect(proxy.fakeApi.wsMessages[0]?.data.limit).toBe(50);
  });

  it("forwards the headers upstream identifies a Device by", async () => {
    await subscribe({ routeStopPairs: `${DART},${PEARSE}`, limit: 1 }, 2);

    const [request] = proxy.fakeApi.wsRequests;
    expect(request?.headers["x-device-id"]).toBe("device-1");
    expect(request?.headers["x-forwarded-for"]).toBe("203.0.113.7, 10.0.0.1");
  });
});
