import {
  defineRailway,
  github,
  group,
  postgres,
  preserve,
  project,
  type RailwayProvidedVariable,
  type ReferencableServiceNode,
  redis,
  service,
} from "railway/iac";

function railwayPrivateNetworkingUrl(
  target: ReferencableServiceNode<RailwayProvidedVariable>,
): string {
  return `http://${toReferenceSyntax(target, "RAILWAY_PRIVATE_DOMAIN")}:${toReferenceSyntax(target, "PORT")}`;
}

// The SDK only supports whole-value references, so use Railway's
// `${{service.VAR}}` syntax to compose them into a string.
function toReferenceSyntax<K extends string>(
  target: ReferencableServiceNode<K>,
  variable: NoInfer<K>,
): string {
  return `\${{${target.name}.${variable}}}`;
}

const FEEDS_CONFIG = `feeds:
  nta:
    name: Transport for Ireland
    description: Ireland
    gtfs:
      static:
        url: https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip
      rtTripUpdates:
        url: https://api.nationaltransport.ie/gtfsr/v2/TripUpdates
        headers:
          x-api-key: \${{NTA_API_KEY}}
`;

export default defineRailway(() => {
  // Deploy a commit only once its GitHub checks (CI, Railway apply) pass
  const transitTracker = github("conor-ob/transit-tracker", {
    checkSuites: true,
  });

  const postgresDatabase = postgres("postgres", {
    region: "europe-west4-drams3a",
  });

  const redisCache = redis("redis", {
    region: "europe-west4-drams3a",
  });

  const api = service("api", {
    // source: image("ghcr.io/conor-ob/transit-tracker-api:custom"),
    source: github("conor-ob/transit-tracker-api", {
      branch: "custom",
      checkSuites: true,
    }),
    env: {
      PORT: "3000",
      DATABASE_URL: postgresDatabase.env.DATABASE_URL,
      REDIS_URL: redisCache.env.REDIS_URL,
      FEED_SYNC_SCHEDULE: "0 3 * * *",
      GTFS_RT_MIN_CACHE_AGE: "60s",
      LOG_JSON: "true",
      TRUST_PROXY: "true",
      INTERNAL_API_KEY: preserve(),
      NTA_API_KEY: preserve(),
      FEEDS_CONFIG,
    },
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    preDeploy: "pnpm gtfs:db:migrate",
    deploy: {
      multiRegionConfig: { "europe-west4-drams3a": { numReplicas: 1 } },
      healthcheckPath: "/healthz",
    },
  });

  // Applies Direction filters to the schedule, between the gateway and the
  // unmodified api
  const scheduleProxy = service("schedule-proxy", {
    source: transitTracker,
    env: {
      PORT: "8080",
      API_URL: railwayPrivateNetworkingUrl(api),
    },
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "apps/schedule-proxy/Dockerfile",
    },
    deploy: {
      multiRegionConfig: { "europe-west4-drams3a": { numReplicas: 1 } },
      healthcheckPath: "/healthz",
    },
  });

  // Proxies everything to the api and schedule-proxy over private networking,
  // so neither needs a public domain
  const gateway = service("gateway", {
    source: transitTracker,
    domains: [{ domain: "transit-tracker.conorob.me", port: 8080 }],
    env: {
      PORT: "8080",
      API_URL: railwayPrivateNetworkingUrl(api),
      SCHEDULE_PROXY_URL: railwayPrivateNetworkingUrl(scheduleProxy),
    },
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "apps/gateway/Dockerfile",
    },
    deploy: {
      multiRegionConfig: { "europe-west4-drams3a": { numReplicas: 1 } },
      healthcheckPath: "/healthz",
    },
  });

  const database = group("database", [postgresDatabase, redisCache]);
  const backend = group("backend", [api, scheduleProxy]);
  const gatewayGroup = group("gateway", [gateway]);

  return project("transit-tracker", {
    resources: [backend, database, gatewayGroup],
  });
});
