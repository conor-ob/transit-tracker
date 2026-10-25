# Customize schedules in a proxy, not a fork

Our customizations to the schedule (starting with Direction filters) live in our own `schedule-proxy` service in front of the unmodified upstream `transit-tracker-api` image, not in a fork of it. This keeps every change in this repo and avoids carrying a rebase against upstream, at the cost of filtering after upstream has applied its trip limit, so the proxy asks upstream for the maximum and trims the result itself.

## Consequences

- `transit-tracker-api` runs upstream's `ghcr.io/tjhorner/transit-tracker-api:main` image unchanged. It briefly built from the `custom` branch of a temporary fork, [conor-ob/transit-tracker-api](https://github.com/conor-ob/transit-tracker-api), until `schedule-proxy` covered what that fork carried.
- Devices express a Direction filter as a fourth field on a Route-stop pair (`route,stop,offset,direction`, offset may be blank). The proxy strips that field before forwarding, so upstream only ever sees the format it supports today, and a Device pointed at plain upstream still works, just unfiltered.
- Neither the web configurator nor the firmware's YAML `stops:` option can produce that fourth field, so Devices are configured through the stock firmware's `schedule_config` text setting, from setup scripts versioned in this repo.
- Direction filters are proposed upstream on [tjhorner/transit-tracker-api#163](https://github.com/tjhorner/transit-tracker-api/issues/163). If upstream adopts them, the proxy drops its own filtering but stays as the home for other customizations.
