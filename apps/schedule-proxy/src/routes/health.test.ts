import { expect, it } from "vitest";

import { useScheduleProxy } from "~/test/fake-api";

const proxy = useScheduleProxy();

it("answers its health check", async () => {
  const response = await proxy.server.inject("/healthz");
  expect(response.statusCode).toBe(200);
});
