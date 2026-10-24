import { buildApp } from "./app";

const apiUrl = process.env.API_URL;
if (!apiUrl) {
  throw new Error("API_URL is required");
}

const app = await buildApp({
  apiUrl: apiUrl.replace(/\/$/, ""),
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

// Railway's private network is IPv6, so listen on every address
await app.listen({ host: "::", port: Number(process.env.PORT ?? 8080) });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void app.close();
  });
}
