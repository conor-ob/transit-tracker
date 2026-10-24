import type { FastifyInstance } from "fastify";

export default function (fastify: FastifyInstance) {
  fastify.get("/healthz", async () => ({ status: "ok" }));
}
