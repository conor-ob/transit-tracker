# Applies Direction filters to the schedule between the gateway and the api.
# Built from the repo root so the workspace lockfile is in the context
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/schedule-proxy/package.json apps/schedule-proxy/
RUN pnpm install --frozen-lockfile --prod --filter schedule-proxy

COPY apps/schedule-proxy/src apps/schedule-proxy/src

WORKDIR /app/apps/schedule-proxy
ENV NODE_ENV=production
USER node
CMD ["node", "src/main.ts"]
