import FastifyWebsocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";

// Awaited before the WebSocket route is added, so the route is upgraded
export default async function (fastify: FastifyInstance) {
  await fastify.register(FastifyWebsocket);
}
