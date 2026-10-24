# syntax=docker/dockerfile:1

# Applies Direction filters to the schedule between the gateway and transit-tracker-api.
# Built from the repo root so turbo can prune the workspace down to this app

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat
# Use the pnpm version pinned in package.json#packageManager
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install --global corepack@latest && corepack enable


# Prune the monorepo down to @transit-tracker/schedule-proxy and its workspace
# dependencies
FROM base AS pruner
WORKDIR /app
RUN npm install --global turbo@2
COPY . .
RUN turbo prune @transit-tracker/schedule-proxy --docker


# Build schedule-proxy
FROM base AS builder
WORKDIR /app

# Install dependencies first so they are cached between source changes
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@transit-tracker/schedule-proxy
RUN pnpm prune --prod --no-optional
RUN rm -rf ./**/*/src


# Run schedule-proxy as a non-root user
FROM node:${NODE_VERSION}-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/apps/schedule-proxy

ENV NODE_ENV=production

CMD ["node", "dist/index.mjs"]
