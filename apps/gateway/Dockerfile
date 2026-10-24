# Caddy reverse proxy in front of transit-tracker-api
FROM caddy:2-alpine

COPY apps/gateway/Caddyfile /etc/caddy/Caddyfile

RUN caddy fmt --overwrite /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
