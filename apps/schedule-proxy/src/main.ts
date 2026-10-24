import { buildApp } from "./app";
import { env } from "./env/schema";

const app = await buildApp({
  apiUrl: env.API_URL,
  logger: { level: env.LOG_LEVEL },
});

// Railway's private network is IPv6, so listen on every address
await app.listen({ host: "::", port: env.PORT });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void app.close();
  });
}
