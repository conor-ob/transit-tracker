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

The API listens on <http://localhost:3000>, and `schedule-proxy` on <http://localhost:8080> (WebSocket at the root and `/schedule/...`, with [Direction filters](#direction-filters)). To check it's running, open <http://localhost:3000/feeds>, which lists the configured feeds. The OpenAPI spec is served at `/openapi`.

After the first import, the API syncs the feed daily at 03:00 (`FEED_SYNC_SCHEDULE`). Stop the stack with `pnpm compose:down`. To wipe the local database as well, run `docker compose down -v`.

## Deploying to Railway

The Railway project is defined in code in [`.railway/railway.ts`](.railway/railway.ts) and has these services:

- **gateway**: Caddy ([`apps/gateway`](apps/gateway)) on the public domain. It sends WebSocket upgrades and `/schedule/*` to `schedule-proxy`, and everything else to `transit-tracker-api`, both over private networking
- **schedule-proxy**: applies [Direction filters](#direction-filters) to the schedule ([`apps/schedule-proxy`](apps/schedule-proxy)), and uses `/healthz` as its health check

- **transit-tracker-api**: the `ghcr.io/tjhorner/transit-tracker-api:main` image on port 3000. It runs `pnpm gtfs:db:migrate` before each deploy and uses `/healthz` as its health check
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

1. Set the secrets above on the `transit-tracker-api` service.
2. Run the first GTFS import: `railway ssh --service transit-tracker-api`, then `node ./dist/cli sync`.
3. Add the DNS records Railway shows for the `gateway` service's custom domain, `transit-tracker.conorob.me`, at your DNS provider.

## Using it with a Transit Tracker board

This API is the backend for [Transit Tracker](https://transit-tracker.eastsideurbanism.org/), an open-source DIY arrivals board built on an ESP32-S3 and an LED matrix. The board doesn't read GTFS itself because it doesn't have the memory or CPU to process it. Instead it holds a WebSocket open to an API server, which sends it a small list of upcoming trips. By default boards connect to the community server at `tt.horner.tj`. Pointing them at this deployment gives them the Transport for Ireland feed. The [Transit Tracker docs](https://eastsideurbanism.github.io/transit-tracker) cover building a board and the self-hosting option.

Three upstream projects make up the stack. This repo only deploys the first. Use the other two to customise what a board shows or to build your own:

- **[transit-tracker-api](https://github.com/tjhorner/transit-tracker-api)**: the server this repo deploys. It imports GTFS, GTFS-Realtime, OneBusAway, HAFAS or MVG data and streams trips for chosen route/stop pairs over WebSocket. It also serves a REST API (`/feeds`, `/stops/within/...`, `/schedule/...`) that the configurator uses to search stops and routes. Change it to add a new kind of data source by implementing its `FeedProvider` interface. To add another GTFS agency, just add a feed to `FEEDS_CONFIG`.
- **[transit-tracker-configurator](https://github.com/tjhorner/transit-tracker-configurator)**: the web app at [transit-tracker.eastsideurbanism.org/configurator](https://transit-tracker.eastsideurbanism.org/configurator), written in SvelteKit. It flashes firmware over USB, sets up Wi-Fi, picks stops and routes from a map, and sets route colours, abbreviations, walking-time offsets and the display layout. It pushes these settings to the board over USB or the local network, or exports them as ESPHome YAML. To use this deployment, open **Advanced → API Server** in the hosted configurator and enter this deployment's public `https://` URL. The configurator checks `/feeds` before saving, and the upstream API enables CORS, so this works without any changes here. Build it yourself with `PUBLIC_API_HOST` set to change the default server, for example so it starts on Irish stops.
- **[esphome-transit-tracker](https://github.com/tjhorner/esphome-transit-tracker)**: the `transit_tracker` [ESPHome](https://esphome.io/) external component that runs on the board. It connects to the API, then draws the schedule on any ESPHome display (it's tuned for a 128x64 HUB75 matrix). Use it directly to put departures on your own hardware or into your own ESPHome or Home Assistant config. Set `base_url` to this deployment with a `wss://` scheme, and optionally set `feed_code: nta`. The configurator's "Generate YAML" button writes the `transit_tracker:` block for you. [`examples/matrix-portal-s3.yaml`](https://github.com/tjhorner/esphome-transit-tracker/blob/main/examples/matrix-portal-s3.yaml) is a complete device config.

## Direction filters

A DART station is a single stop served in both directions, so a board subscribed to it shows trains both ways. `schedule-proxy` lets a Route-stop pair carry a Direction (the route's GTFS `direction_id`, `0` or `1`) as a fourth field, `route,stop,offset,direction`, where the Offset may be blank:

```txt
nta:BRAY-HOWTH-I,nta:8220IR0134,,1
```

For the DART, Direction `0` is northbound (Howth/Malahide) and `1` is southbound (Bray/Greystones). The proxy strips the field before forwarding to `transit-tracker-api`, drops trips travelling the other way (trips with no `directionId` are kept), and trims to the client's own limit. Pairs without a Direction are untouched. See [ADR 0001](docs/adr/0001-customize-schedules-in-a-proxy.md) for why this lives in a proxy rather than a fork.

## Configuring the Device

Neither the configurator nor the firmware's YAML `stops:` option can write a Direction filter, so the Device's settings are versioned here in [`scripts/configure-device.sh`](scripts/configure-device.sh). The script sets the server, feed code, schedule, route colours and list mode over the Device's web server, then restarts it. It needs `curl` and `jq`, and a machine on the same LAN as the Device:

```sh
scripts/configure-device.sh <device ip>
```

It stops at the first request that fails, so the Device is never restarted half-configured.

With `feed_code_config` set to `nta`, route and stop IDs in `schedule_config` go without the `nta:` prefix (a prefixed ID matches no trips). The firmware caps `schedule_config` at 255 characters, which limits how many Route-stop pairs a Device can have.

Route styles are set in `route_styles_config`, one `route;name;colour` line per route, with route IDs unprefixed as in the schedule. The name replaces the route's own name on the Device, so each line repeats it. Routes without a line fall back to the feed's colour, or the firmware's default when the feed has none.

## Development

It's a [Turborepo](https://turborepo.com) monorepo on pnpm workspaces. Install dependencies with `pnpm install`, then:

- `pnpm check`: Biome formatting, lint and import order
- `pnpm check:fix`: apply Biome fixes
- `pnpm typecheck`: type-check every app
- `pnpm build`: build every app (`schedule-proxy` is bundled with [tsdown](https://tsdown.dev) into `dist/index.mjs`)
- `pnpm test`: run every app's tests
- `pnpm dev`: run every app in watch mode (copy `apps/schedule-proxy/.env.example` to `.env` first; the env is validated at startup against [`src/env/schema.ts`](apps/schedule-proxy/src/env/schema.ts))

CI ([`ci.yaml`](.github/workflows/ci.yaml)) runs the checks, typecheck, build and tests on every PR.

## Credits

All application code is by [TJ Horner](https://github.com/tjhorner) and contributors and is MIT-licensed. See the [upstream repository](https://github.com/tjhorner/transit-tracker-api).
