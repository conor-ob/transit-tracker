import Fastify, { type FastifyServerOptions } from "fastify";

import registerWebsocketPlugin from "~/plugins/websocket";
import registerHealthCheckRoute from "~/routes/health";
import registerScheduleRoute from "~/routes/schedule";
import registerScheduleWebsocketRoute from "~/routes/schedule-websocket";

export interface ServerOptions {
  // The api's base URL, e.g. http://api:3000
  apiUrl: string;
  logger?: FastifyServerOptions["logger"];
}

export async function createServer({ apiUrl, logger = false }: ServerOptions) {
  const fastify = Fastify({ logger });

  await registerWebsocketPlugin(fastify);
  registerHealthCheckRoute(fastify);
  registerScheduleRoute(fastify, apiUrl);
  registerScheduleWebsocketRoute(fastify, apiUrl.replace(/^http/, "ws"));

  return fastify;
}
