import { env } from "~/env/schema";
import { createServer } from "~/server";

const server = await createServer({
  apiUrl: env.TRANSIT_TRACKER_API_URL,
  logger: { level: env.LOG_LEVEL },
});

// Railway's private network is IPv6, so listen on every address
await server.listen({ host: "::", port: env.PORT });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void server.close();
  });
}
