import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude],
    reporters: "verbose",
    // Tests don't read a developer's .env, so they run the same in CI
    env: {
      PORT: "8080",
      API_URL: "http://127.0.0.1:9",
    },
  },
});
