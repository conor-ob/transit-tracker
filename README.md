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

The Railway project is defined in code in [`.railway/railway.ts`](.railway/railway.ts) and has three services:

- **api**: the `ghcr.io/tjhorner/transit-tracker-api:main` image on port 3000. It runs `pnpm gtfs:db:migrate` before each deploy and uses `/healthz` as its health check
- **postgres**: Railway-managed, stores the imported GTFS data
- **redis**: Railway-managed, used for caching, rate limiting and sync scheduling

Feeds sync daily at 03:00 (`FEED_SYNC_SCHEDULE`).

### Deploys

Deploys run from GitHub Actions ([`deploy.yaml`](.github/workflows/deploy.yaml)) using the `RAILWAY_TOKEN` repo secret:

- A PR that changes `.railway/` runs `railway config plan` and posts the plan as a comment.
- Merging that PR to `main` applies exactly that plan.

To preview a plan locally, run `railway link` and then `railway config plan`. Planning doesn't change anything on Railway.

### Secrets

These are `preserve()` in the config, so they're set in the Railway dashboard and never committed:

| Variable | Value |
| -------- | ----- |
| `NTA_API_KEY` | your NTA API key |
| `INTERNAL_API_KEY` | a long random string, e.g. from `openssl rand -hex 32`. Without it, internal endpoints are open to anyone |

### After the first deploy

1. Set the secrets above on the `api` service.
2. Run the first GTFS import: `railway ssh --service api`, then `node ./dist/cli sync`.
3. Generate a public domain for `api` on port 3000.

## Development

Install dependencies with `pnpm install`, then:

- `pnpm check`: Biome formatting, lint and import order
- `pnpm fix`: apply Biome fixes
- `pnpm typecheck`: type-check `.railway/railway.ts`

CI ([`ci.yaml`](.github/workflows/ci.yaml)) runs both checks on every PR.

## Credits

All application code is by [TJ Horner](https://github.com/tjhorner) and contributors and is MIT-licensed. See the [upstream repository](https://github.com/tjhorner/transit-tracker-api).
