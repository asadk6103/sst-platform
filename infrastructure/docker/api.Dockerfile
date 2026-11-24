# SST API — multi-stage build (build context: repository root)
# Debian slim (glibc) is used so Prisma engines and sharp work without extra native builds.

FROM node:24-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
ENV SCARF_ANALYTICS=false \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ── dependencies (cached unless a manifest or the lockfile changes) ──
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
# every workspace manifest must be present for `npm ci` to match the lockfile
COPY frontend/admin-portal/package.json frontend/admin-portal/
COPY frontend/public-website/package.json frontend/public-website/
RUN npm ci --workspace backend --workspace @sst/shared --include-workspace-root --no-audit --no-fund

# ── development image (source is bind-mounted by docker-compose.dev.yml) ──
FROM deps AS dev
COPY backend/prisma backend/prisma
RUN npx --workspace backend prisma generate
WORKDIR /app/backend
CMD ["sh", "/app/infrastructure/docker/api-entrypoint.sh", "dev"]

# ── production build ──
FROM deps AS build
COPY packages/shared packages/shared
COPY backend backend
RUN npm run build --workspace backend \
 && npm prune --omit=dev --workspace backend --workspace @sst/shared --include-workspace-root --no-audit --no-fund

# ── production runtime ──
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY infrastructure/docker/api-entrypoint.sh /app/infrastructure/docker/api-entrypoint.sh
WORKDIR /app/backend
RUN mkdir -p /app/backend/uploads /app/backend/private-uploads /app/backend/config && chown -R node:node /app/backend/uploads /app/backend/private-uploads /app/backend/config
USER node
EXPOSE 4200
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4200/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "/app/infrastructure/docker/api-entrypoint.sh", "prod"]
