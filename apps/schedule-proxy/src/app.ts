import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";
import { scheduleRest } from "./rest.ts";
import { scheduleWebSocket } from "./websocket.ts";

export interface AppOptions {
  // The api's base URL, e.g. http://api:3000
  apiUrl: string;
  logger?: FastifyServerOptions["logger"];
}

export async function buildApp({ apiUrl, logger = false }: AppOptions) {
  const app = Fastify({ logger });
  const apiWsUrl = apiUrl.replace(/^http/, "ws");

  await app.register(websocket);

  app.get("/healthz", async () => ({ status: "ok" }));
  scheduleRest(app, apiUrl);
  scheduleWebSocket(app, apiWsUrl);

  return app;
}
