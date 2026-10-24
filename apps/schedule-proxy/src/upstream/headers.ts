import type { IncomingHttpHeaders } from "node:http";

// Headers upstream reads to identify a client. X-Forwarded-For goes up as
// Caddy sent it, without this hop's address appended: upstream trusts two
// proxy hops, and with the proxy as one of them the client is still the next
// address along
const FORWARDED_HEADERS = [
  "user-agent",
  "x-device-id",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
];

export function upstreamHeaders(
  headers: IncomingHttpHeaders,
): Record<string, string> {
  const forwarded: Record<string, string> = {};

  for (const name of FORWARDED_HEADERS) {
    const value = headers[name];
    if (value !== undefined) {
      forwarded[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  return forwarded;
}
