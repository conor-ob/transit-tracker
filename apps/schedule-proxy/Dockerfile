# Applies Direction filters to the schedule between the gateway and the api.
# Built from the repo root so turbo can prune the workspace down to this app
# https://fintlabs.medium.com/optimized-multi-stage-docker-builds-with-turborepo-and-pnpm-for-nodejs-microservices-in-a-monorepo-c686fdcf051f

# Base Alpine image
FROM node:24-alpine AS alpine
RUN apk add --no-cache libc6-compat

# Setup pnpm and turbo
FROM alpine AS base
RUN npm install -g pnpm turbo \
    && pnpm config set store-dir /root/.local/share/pnpm/store/v3

# Prune projects to isolate subworkspace
FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=@transit-tracker/schedule-proxy --docker

# Build stage
FROM base AS builder

WORKDIR /app

# Copy only lockfiles and pruned workspace manifests first
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/json/ .

# Install dependencies (layer cached by Docker if lockfile unchanged)
RUN pnpm install --frozen-lockfile

# Copy full source for the isolated workspace
COPY --from=pruner /app/out/full/ .

RUN turbo build --filter=@transit-tracker/schedule-proxy

# Prune production dependencies
RUN pnpm prune --prod --no-optional
RUN rm -rf ./**/*/src

# Runner stage
FROM alpine AS runner
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app .
WORKDIR /app/apps/schedule-proxy

ENV NODE_ENV=production

CMD ["node", "dist/main.mjs"]
