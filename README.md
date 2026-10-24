# transit-tracker-api

A deployment of [tjhorner/transit-tracker-api](https://github.com/tjhorner/transit-tracker-api) configured for Irish public transport, using the National Transport Authority's GTFS and GTFS-Realtime feeds. It runs locally with Docker Compose and is deployed to [Railway](https://railway.com).

This repo doesn't fork the upstream source. It runs the published `ghcr.io/tjhorner/transit-tracker-api:main` image and only holds the feed configuration and deployment setup.

## Feeds

| Feed code | Source | Static GTFS | Realtime |
| --------- | ------ | ----------- | -------- |
| `nta` | [National Transport Authority](https://developer.nationaltransport.ie/) | [`GTFS_Realtime.zip`](https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip) | GTFS-R v2 TripUpdates |

The feed code is part of the client-facing API, so don't change it once clients use it. The upstream [feeds JSON Schema](https://github.com/tjhorner/transit-tracker-api/blob/main/schemas/feeds.schema.json) lists every available option.

## Running locally

You need Docker and an NTA API key, which you can get free from the [NTA developer portal](https://developer.nationaltransport.ie/).

1. Create a `.env` file and put your key in it:

   ```sh
   cp .env.example .env
   ```

2. Run the database migrations and the first GTFS import. This is a one-off step, and the import takes a few minutes:

   ```sh
   docker compose run --rm api "pnpm gtfs:db:migrate && node ./dist/cli sync"
   ```

3. Start the stack:

   ```sh
   docker compose up -d
   ```

The API listens on <http://localhost:3000>. To check it's running, open <http://localhost:3000/feeds>, which lists the configured feeds. The OpenAPI spec is served at `/openapi`.

After the first import, the API schedules its own feed syncs through Redis.

## Deploying to Railway

The Railway project has three services:

- **api**: the `ghcr.io/tjhorner/transit-tracker-api:main` image, exposed publicly on port 3000
- **Postgres**: Railway-managed, stores the imported GTFS data
- **Redis**: Railway-managed, used for caching, rate limiting and sync scheduling

Set these variables on the `api` service:

| Variable | Value |
| -------- | ----- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `NTA_API_KEY` | your NTA API key |
| `FEEDS_CONFIG` | the `feeds:` YAML from `compose.yaml`, with the key set to `${{NTA_API_KEY}}` |

Set the service's pre-deploy command to `pnpm gtfs:db:migrate`. After the first deploy, run the initial import once with `railway ssh` and then `node ./dist/cli sync`.

## Credits

All application code is by [TJ Horner](https://github.com/tjhorner) and contributors and is MIT-licensed. See the [upstream repository](https://github.com/tjhorner/transit-tracker-api).
