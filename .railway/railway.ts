import {
  defineRailway,
  group,
  image,
  postgres,
  preserve,
  project,
  redis,
  service,
} from "railway/iac";

const FEEDS_CONFIG = `feeds:
  nta:
    name: NTA GTFS-R
    description: The GTFS-R API contains real-time updates for services provided by Dublin Bus, Bus Éireann, and Go-Ahead Ireland
    gtfs:
      static:
        url: https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip
      rtTripUpdates:
        url: https://api.nationaltransport.ie/gtfsr/v2/TripUpdates
        headers:
          x-api-key: \${{NTA_API_KEY}}
`;

export default defineRailway(() => {
  const postgresDatabase = postgres("postgres", {
    region: "europe-west4-drams3a",
  });

  const redisCache = redis("redis", {
    region: "europe-west4-drams3a",
  });

  const api = service("api", {
    source: image("ghcr.io/tjhorner/transit-tracker-api:main"),
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
    preDeploy: "pnpm gtfs:db:migrate",
    deploy: {
      multiRegionConfig: { "europe-west4-drams3a": { numReplicas: 1 } },
      healthcheckPath: "/healthz",
    },
  });

  const database = group("database", [postgresDatabase, redisCache]);
  const backend = group("backend", [api]);

  return project("transit-tracker-api", {
    resources: [backend, database],
  });
});
