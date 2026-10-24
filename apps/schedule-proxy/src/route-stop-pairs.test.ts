import { describe, expect, it } from "vitest";
import {
  applyDirectionFilters,
  InvalidDirectionError,
  parseRouteStopPairs,
  type RouteStopPair,
  toUpstreamRouteStopPairs,
} from "./route-stop-pairs";

describe("parseRouteStopPairs", () => {
  it("parses a Direction filter with a blank Offset", () => {
    expect(parseRouteStopPairs("BRAY-HOWTH-I,8220IR0134,,1")).toEqual([
      {
        routeId: "BRAY-HOWTH-I",
        stopId: "8220IR0134",
        offset: "",
        direction: "1",
      },
    ]);
  });

  it("parses a Direction filter with a numeric Offset", () => {
    expect(parseRouteStopPairs("BRAY-HOWTH-I,8220IR0134,-300,0")).toEqual([
      {
        routeId: "BRAY-HOWTH-I",
        stopId: "8220IR0134",
        offset: "-300",
        direction: "0",
      },
    ]);
  });

  it("parses pairs without a fourth field", () => {
    expect(parseRouteStopPairs("46A,8220DB000123;46A,8220DB000124,60")).toEqual(
      [
        { routeId: "46A", stopId: "8220DB000123", offset: "", direction: null },
        {
          routeId: "46A",
          stopId: "8220DB000124",
          offset: "60",
          direction: null,
        },
      ],
    );
  });

  it("trims whitespace around each field", () => {
    expect(parseRouteStopPairs(" 46A , 8220DB000123 , , 1 ")).toEqual([
      { routeId: "46A", stopId: "8220DB000123", offset: "", direction: "1" },
    ]);
  });

  it.each(["2", "-1", "north", "01"])('rejects Direction "%s"', (direction) => {
    expect(() => parseRouteStopPairs(`46A,8220DB000123,,${direction}`)).toThrow(
      InvalidDirectionError,
    );
  });
});

describe("toUpstreamRouteStopPairs", () => {
  it("strips Direction filters and keeps Offsets", () => {
    const pairs = parseRouteStopPairs(
      "BRAY-HOWTH-I,8220IR0134,,1;BRAY-HOWTH-I,8220IR0135,-300,0;46A,8220DB000123",
    );

    expect(toUpstreamRouteStopPairs(pairs)).toBe(
      "BRAY-HOWTH-I,8220IR0134;BRAY-HOWTH-I,8220IR0135,-300;46A,8220DB000123",
    );
  });
});

describe("applyDirectionFilters", () => {
  const trip = (
    routeId: string,
    stopId: string,
    directionId: string | null,
  ) => ({
    routeId,
    stopId,
    directionId,
  });

  const southbound: RouteStopPair = {
    routeId: "BRAY-HOWTH-I",
    stopId: "8220IR0134",
    offset: "",
    direction: "1",
  };

  it("drops trips travelling in the other Direction", () => {
    const trips = [
      trip("BRAY-HOWTH-I", "8220IR0134", "0"),
      trip("BRAY-HOWTH-I", "8220IR0134", "1"),
      trip("BRAY-HOWTH-I", "8220IR0134", "0"),
    ];

    expect(applyDirectionFilters(trips, [southbound], 20)).toEqual([
      trip("BRAY-HOWTH-I", "8220IR0134", "1"),
    ]);
  });

  it("keeps trips with a null directionId", () => {
    const trips = [trip("BRAY-HOWTH-I", "8220IR0134", null)];

    expect(applyDirectionFilters(trips, [southbound], 20)).toEqual(trips);
  });

  it("leaves pairs without a Direction filter untouched", () => {
    const pairs: RouteStopPair[] = [
      southbound,
      { routeId: "46A", stopId: "8220DB000123", offset: "", direction: null },
    ];
    const trips = [
      trip("46A", "8220DB000123", "0"),
      trip("BRAY-HOWTH-I", "8220IR0134", "0"),
      trip("46A", "8220DB000123", "1"),
    ];

    expect(applyDirectionFilters(trips, pairs, 20)).toEqual([
      trip("46A", "8220DB000123", "0"),
      trip("46A", "8220DB000123", "1"),
    ]);
  });

  it("only filters the same route at the same stop", () => {
    const trips = [
      trip("BRAY-HOWTH-I", "8220IR0135", "0"),
      trip("46A", "8220IR0134", "0"),
    ];

    expect(applyDirectionFilters(trips, [southbound], 20)).toEqual(trips);
  });

  it("trims to the limit after filtering", () => {
    const trips = [
      trip("BRAY-HOWTH-I", "8220IR0134", "0"),
      trip("BRAY-HOWTH-I", "8220IR0134", "1"),
      trip("BRAY-HOWTH-I", "8220IR0134", "0"),
      trip("BRAY-HOWTH-I", "8220IR0134", "1"),
      trip("BRAY-HOWTH-I", "8220IR0134", "1"),
    ];

    expect(applyDirectionFilters(trips, [southbound], 2)).toHaveLength(2);
    expect(applyDirectionFilters(trips, [southbound], 5)).toHaveLength(3);
  });
});
