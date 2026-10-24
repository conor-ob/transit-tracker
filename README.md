# transit-tracker

A deployment of [tjhorner/transit-tracker-api](https://github.com/tjhorner/transit-tracker-api) configured for Irish public transport, using the National Transport Authority's GTFS and GTFS-Realtime feeds. It runs locally with Docker Compose and is deployed to [Railway](https://railway.com).

This repo doesn't fork the upstream source. It runs the published `ghcr.io/tjhorner/transit-tracker-api:main` image and only holds the feed configuration and deployment setup.

## Feeds

| Feed code | Source | Static GTFS | Realtime |
| --------- | ------ | ----------- | -------- |
| `nta` | [National Transport Authority](https://developer.nationaltransport.ie/) | [`GTFS_Realtime.zip`](https://www.transportforireland.ie/transitData/Data/GTFS_Realtime.zip) | GTFS-R v2 TripUpdates |

The feed code is part of the client-facing API, so don't change it once clients use it. The upstream [feeds JSON Schema](https://github.com/tjhorner/transit-tracker-api/blob/main/schemas/feeds.schema.json) lists every available option.

## Running locally

You need Docker, pnpm and an NTA API key, which you can get free from the [NTA developer portal](https://developer.nationaltransport.ie/).

1. Create a `.env` file and put your key in it:

   ```sh
   cp .env.example .env
   ```

2. Run the database migrations and the first GTFS import. The import takes a few minutes. Run it again whenever you want fresh data:

   ```sh
   pnpm compose:sync
   ```

3. Start the stack:

   ```sh
   pnpm compose:up
   ```

The API listens on <http://localhost:3000>. To check it's running, open <http://localhost:3000/feeds>, which lists the configured feeds. The OpenAPI spec is served at `/openapi`.

After the first import, the API syncs the feed daily at 03:00 (`FEED_SYNC_SCHEDULE`). Stop the stack with `pnpm compose:down`. To wipe the local database as well, run `docker compose down -v`.

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

## Using it with a Transit Tracker board

This API is the backend for [Transit Tracker](https://transit-tracker.eastsideurbanism.org/), an open-source DIY arrivals board built on an ESP32-S3 and an LED matrix. The board doesn't read GTFS itself because it doesn't have the memory or CPU to process it. Instead it holds a WebSocket open to an API server, which sends it a small list of upcoming trips. By default boards connect to the community server at `tt.horner.tj`. Pointing them at this deployment gives them the Transport for Ireland feed. The [Transit Tracker docs](https://eastsideurbanism.github.io/transit-tracker) cover building a board and the self-hosting option.

Three upstream projects make up the stack. This repo only deploys the first. Use the other two to customise what a board shows or to build your own:

- **[transit-tracker-api](https://github.com/tjhorner/transit-tracker-api)**: the server this repo deploys. It imports GTFS, GTFS-Realtime, OneBusAway, HAFAS or MVG data and streams trips for chosen route/stop pairs over WebSocket. It also serves a REST API (`/feeds`, `/stops/within/...`, `/schedule/...`) that the configurator uses to search stops and routes. Change it to add a new kind of data source by implementing its `FeedProvider` interface. To add another GTFS agency, just add a feed to `FEEDS_CONFIG`.
- **[transit-tracker-configurator](https://github.com/tjhorner/transit-tracker-configurator)**: the web app at [transit-tracker.eastsideurbanism.org/configurator](https://transit-tracker.eastsideurbanism.org/configurator), written in SvelteKit. It flashes firmware over USB, sets up Wi-Fi, picks stops and routes from a map, and sets route colours, abbreviations, walking-time offsets and the display layout. It pushes these settings to the board over USB or the local network, or exports them as ESPHome YAML. To use this deployment, open **Advanced → API Server** in the hosted configurator and enter this deployment's public `https://` URL. The configurator checks `/feeds` before saving, and the upstream API enables CORS, so this works without any changes here. Build it yourself with `PUBLIC_API_HOST` set to change the default server, for example so it starts on Irish stops.
- **[esphome-transit-tracker](https://github.com/tjhorner/esphome-transit-tracker)**: the `transit_tracker` [ESPHome](https://esphome.io/) external component that runs on the board. It connects to the API, then draws the schedule on any ESPHome display (it's tuned for a 128x64 HUB75 matrix). Use it directly to put departures on your own hardware or into your own ESPHome or Home Assistant config. Set `base_url` to this deployment with a `wss://` scheme, and optionally set `feed_code: nta`. The configurator's "Generate YAML" button writes the `transit_tracker:` block for you. [`examples/matrix-portal-s3.yaml`](https://github.com/tjhorner/esphome-transit-tracker/blob/main/examples/matrix-portal-s3.yaml) is a complete device config.

## Development

Install dependencies with `pnpm install`, then:

- `pnpm check`: Biome formatting, lint and import order
- `pnpm check:fix`: apply Biome fixes
- `pnpm typecheck`: type-check `.railway/railway.ts`

CI ([`ci.yaml`](.github/workflows/ci.yaml)) runs both checks on every PR.

## Credits

All application code is by [TJ Horner](https://github.com/tjhorner) and contributors and is MIT-licensed. See the [upstream repository](https://github.com/tjhorner/transit-tracker-api).
