import type { FastifyInstance } from "fastify";

import {
  applyDirectionFilters,
  InvalidDirectionError,
  parseRouteStopPairs,
  type Trip,
  toUpstreamRouteStopPairs,
} from "~/schedule/route-stop-pairs";
import { upstreamHeaders } from "~/upstream/headers";

const UPSTREAM_MAX_LIMIT = 10;

export default function (fastify: FastifyInstance, apiUrl: string) {
  fastify.get<{
    Params: { routeStopPairs: string };
    Querystring: { limit?: string };
  }>("/schedule/:routeStopPairs", async (request, reply) => {
    let pairs: ReturnType<typeof parseRouteStopPairs>;
    try {
      pairs = parseRouteStopPairs(request.params.routeStopPairs);
    } catch (error) {
      if (error instanceof InvalidDirectionError) {
        // Upstream's (NestJS) bad request shape
        return reply.code(400).send({
          message: error.message,
          error: "Bad Request",
          statusCode: 400,
        });
      }
      throw error;
    }

    // Matches upstream: a missing limit means 10, and it never goes above 10
    const limit = Math.min(
      Number(request.query.limit ?? UPSTREAM_MAX_LIMIT),
      UPSTREAM_MAX_LIMIT,
    );

    const url = `${apiUrl}/schedule/${encodeURIComponent(toUpstreamRouteStopPairs(pairs))}?limit=${UPSTREAM_MAX_LIMIT}`;
    const response = await fetch(url, {
      headers: upstreamHeaders(request.headers),
    });

    // Upstream errors pass through unchanged
    if (!response.ok) {
      return reply
        .code(response.status)
        .type(response.headers.get("content-type") ?? "application/json")
        .send(await response.text());
    }

    const schedule = (await response.json()) as { trips: Trip[] };
    return { trips: applyDirectionFilters(schedule.trips, pairs, limit) };
  });
}
