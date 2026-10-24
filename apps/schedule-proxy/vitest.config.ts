import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: [...configDefaults.exclude],
    reporters: "verbose",
    // Tests run against the committed .env.example rather than a developer's
    // .env, so they run the same in CI; the schema test keeps it valid
    env: { ...parse(readFileSync(".env.example")), NODE_ENV: "test" },
  },
});
