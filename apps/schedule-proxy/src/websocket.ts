import type { FastifyInstance } from "fastify";
import { type RawData, WebSocket } from "ws";
import {
  applyDirectionFilters,
  InvalidDirectionError,
  parseRouteStopPairs,
  type RouteStopPair,
  type Trip,
  toUpstreamRouteStopPairs,
} from "./route-stop-pairs.ts";
import { upstreamHeaders } from "./upstream-headers.ts";

const UPSTREAM_MAX_LIMIT = 20;

// Upstream (NestJS) frames every message as { event, data }
interface Message {
  event?: unknown;
  data?: unknown;
}

interface Subscription {
  pairs: RouteStopPair[];
  limit: number;
}

function parseMessage(raw: RawData): Message | null {
  try {
    const message: unknown = JSON.parse(raw.toString());
    return typeof message === "object" && message !== null ? message : null;
  } catch {
    return null;
  }
}

function isValidLimit(limit: unknown): limit is number {
  return (
    Number.isInteger(limit) &&
    (limit as number) >= 1 &&
    (limit as number) <= UPSTREAM_MAX_LIMIT
  );
}

// Codes that can't be sent in a close frame: 1004 is reserved, and 1005 and
// 1006 only ever describe how a connection ended
const UNSENDABLE_CLOSE_CODES = new Set([1004, 1005, 1006]);

function closeCodeToForward(code: number): number | undefined {
  const sendable =
    (code >= 1000 && code <= 1014 && !UNSENDABLE_CLOSE_CODES.has(code)) ||
    (code >= 3000 && code <= 4999);
  return sendable ? code : undefined;
}

export function scheduleWebSocket(app: FastifyInstance, apiWsUrl: string) {
  app.get("/", { websocket: true }, (device, request) => {
    const api = new WebSocket(apiWsUrl, {
      headers: upstreamHeaders(request.headers),
    });

    let subscription: Subscription | null = null;
    const pending: string[] = [];

    const sendToApi = (out: string) => {
      if (api.readyState === WebSocket.OPEN) {
        api.send(out);
      } else {
        pending.push(out);
      }
    };

    device.on("message", (raw, isBinary) => {
      const message = isBinary ? null : parseMessage(raw);

      if (message?.event !== "schedule:subscribe") {
        sendToApi(raw.toString());
        return;
      }

      const data = (message.data ?? {}) as Record<string, unknown>;
      if (typeof data.routeStopPairs !== "string") {
        // Let upstream reject it
        sendToApi(raw.toString());
        return;
      }

      let pairs: RouteStopPair[];
      try {
        pairs = parseRouteStopPairs(data.routeStopPairs);
      } catch (error) {
        if (error instanceof InvalidDirectionError) {
          // Upstream's reply to a bad request, which leaves the connection open
          device.send(
            JSON.stringify({ kind: "invalidInput", error: error.message }),
          );
          return;
        }
        throw error;
      }

      // An invalid limit goes up as it is, so upstream rejects it
      const limit = isValidLimit(data.limit) ? data.limit : null;
      if (limit !== null) {
        subscription = { pairs, limit };
      }

      sendToApi(
        JSON.stringify({
          ...message,
          data: {
            ...data,
            routeStopPairs: toUpstreamRouteStopPairs(pairs),
            limit: limit === null ? data.limit : UPSTREAM_MAX_LIMIT,
          },
        }),
      );
    });

    api.on("open", () => {
      for (const out of pending.splice(0)) {
        api.send(out);
      }
    });

    api.on("message", (raw, isBinary) => {
      const message = isBinary ? null : parseMessage(raw);
      const data = message?.data as { trips?: unknown } | undefined;

      if (
        message?.event !== "schedule" ||
        subscription === null ||
        !Array.isArray(data?.trips)
      ) {
        device.send(raw, { binary: isBinary });
        return;
      }

      device.send(
        JSON.stringify({
          ...message,
          data: {
            ...data,
            trips: applyDirectionFilters(
              data.trips as Trip[],
              subscription.pairs,
              subscription.limit,
            ),
          },
        }),
      );
    });

    device.on("close", (code, reason) => {
      api.close(closeCodeToForward(code), reason);
    });

    api.on("close", (code, reason) => {
      device.close(closeCodeToForward(code), reason);
    });

    device.on("error", (error) => {
      request.log.warn({ err: error }, "Device WebSocket error");
      api.terminate();
    });

    api.on("error", (error) => {
      request.log.error({ err: error }, "Upstream WebSocket error");
      device.close(1011);
    });
  });
}
