import Fastify, { type FastifyServerOptions } from "fastify";

import registerWebsocketPlugin from "~/plugins/websocket";
import registerHealthCheckRoute from "~/routes/health";
import registerScheduleRoute from "~/routes/schedule";
import registerScheduleWebsocketRoute from "~/routes/schedule-websocket";

export interface ServerOptions {
  // transit-tracker-api's base URL, e.g. http://transit-tracker-api:3000
  apiUrl: string;
  logger?: FastifyServerOptions["logger"];
}

export async function createServer({ apiUrl, logger = false }: ServerOptions) {
  const fastify = Fastify({
    logger,
    // Upstream (Express) has no limit on a param, only Node's 16 KiB limit on
    // request headers, so a URL can't be longer than that anyway. Fastify's
    // default of 100 rejects even a few route/stop pairs
    maxParamLength: 16 * 1024,
  });

  await registerWebsocketPlugin(fastify);
  registerHealthCheckRoute(fastify);
  registerScheduleRoute(fastify, apiUrl);
  registerScheduleWebsocketRoute(fastify, apiUrl.replace(/^http/, "ws"));

  return fastify;
}
