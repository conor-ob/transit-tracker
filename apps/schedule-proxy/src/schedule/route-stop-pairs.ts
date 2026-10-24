export type Direction = "0" | "1";

export interface RouteStopPair {
  routeId: string;
  stopId: string;
  offset: string;
  direction: Direction | null;
}

export interface Trip {
  routeId: string;
  stopId: string;
  directionId: string | null;
}

export class InvalidDirectionError extends Error {}

// "BRAY-HOWTH-I,8220IR0134,,1;46A,8220DB000123,-300"
export function parseRouteStopPairs(raw: string): RouteStopPair[] {
  return raw.split(";").map((pair) => {
    const [routeId = "", stopId = "", offset = "", direction = ""] = pair
      .split(",")
      .map((part) => part.trim());

    if (direction !== "" && direction !== "0" && direction !== "1") {
      throw new InvalidDirectionError(
        `Invalid direction "${direction}"; must be 0 or 1`,
      );
    }

    return {
      routeId,
      stopId,
      offset,
      direction: direction === "" ? null : direction,
    };
  });
}

// Upstream only ever sees routeId,stopId[,offset]. Malformed pairs are kept
// as they are so upstream rejects them the way it always has
export function toUpstreamRouteStopPairs(pairs: RouteStopPair[]): string {
  return pairs
    .map(({ routeId, stopId, offset }) =>
      offset === "" ? `${routeId},${stopId}` : `${routeId},${stopId},${offset}`,
    )
    .join(";");
}

export function applyDirectionFilters<T extends Trip>(
  trips: T[],
  pairs: RouteStopPair[],
  limit: number,
): T[] {
  const directions = new Map(
    pairs
      .filter((pair) => pair.direction !== null)
      .map((pair) => [`${pair.routeId},${pair.stopId}`, pair.direction]),
  );

  return trips
    .filter((trip) => {
      const direction = directions.get(`${trip.routeId},${trip.stopId}`);
      // No filter on this pair, or the feed has no direction: keep it
      return (
        direction === undefined ||
        trip.directionId === null ||
        trip.directionId === direction
      );
    })
    .slice(0, limit);
}
