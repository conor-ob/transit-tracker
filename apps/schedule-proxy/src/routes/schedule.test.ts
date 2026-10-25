import { describe, expect, it } from "vitest";

import { DART, PEARSE, trips, useScheduleProxy } from "~/test/fake-api";

describe("REST schedule", () => {
  const proxy = useScheduleProxy();

  it("returns only southbound trips, up to the requested limit", async () => {
    const response = await proxy.server.inject(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE},,1`)}?limit=3`,
    );

    expect(response.statusCode).toBe(200);
    expect(
      response.json().trips.map((trip: { tripId: string }) => trip.tripId),
    ).toEqual(["trip-1", "trip-3", "trip-5"]);
  });

  it("asks upstream for its maximum limit without Direction filters", async () => {
    await proxy.server.inject(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE},-300,1`)}?limit=3`,
    );

    expect(proxy.fakeApi.restRequests[0]?.url).toBe(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE},-300`)}?limit=10`,
    );
  });

  it("returns exactly what upstream does without Direction filters", async () => {
    const response = await proxy.server.inject(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE}`)}?limit=4`,
    );

    expect(response.json()).toEqual({ trips: trips.slice(0, 4) });
  });

  it("defaults to upstream's limit of 10", async () => {
    const response = await proxy.server.inject(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE}`)}`,
    );

    expect(response.json().trips).toHaveLength(10);
  });

  it("accepts as many pairs as upstream allows", async () => {
    // Upstream's maximum of 25 pairs, with NTA-length IDs and Direction filters
    const pairs = Array.from(
      { length: 25 },
      (_, i) => `nta:3 ${100 + i} e a,nta:8250DB0030${10 + i},-300,0`,
    ).join(";");

    const response = await proxy.server.inject(
      `/schedule/${encodeURIComponent(pairs)}`,
    );

    expect(response.statusCode).toBe(200);
    expect(proxy.fakeApi.restRequests).toHaveLength(1);
  });

  it("rejects an invalid Direction as a bad request", async () => {
    const response = await proxy.server.inject(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE},,north`)}`,
    );

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe(
      'Invalid direction "north"; must be 0 or 1',
    );
    expect(proxy.fakeApi.restRequests).toHaveLength(0);
  });

  it("passes upstream errors through unchanged", async () => {
    const response = await proxy.server.inject(
      `/schedule/${encodeURIComponent(`${DART},${PEARSE},soon,1`)}`,
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "Invalid offset; must be a number",
      error: "Bad Request",
      statusCode: 400,
    });
  });
});
