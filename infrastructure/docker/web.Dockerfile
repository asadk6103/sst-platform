# SST public website — Next.js (build context: repository root)
FROM node:24-bookworm-slim AS deps
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/admin-portal/package.json frontend/admin-portal/
COPY frontend/public-website/package.json frontend/public-website/
RUN npm ci --workspace public-website --workspace @sst/shared --include-workspace-root --no-audit --no-fund

# ── development: next dev with hot reload (source bind-mounted) ──
FROM deps AS dev
WORKDIR /app/frontend/public-website
EXPOSE 3000
CMD ["npx", "next", "dev", "-p", "3000", "-H", "0.0.0.0"]

# ── production build (no API access needed: every page renders on request) ──
FROM deps AS build
ARG API_INTERNAL_URL=http://api:4200
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
COPY packages/shared packages/shared
COPY frontend/public-website frontend/public-website
RUN npm run build --workspace public-website

# ── runtime: standalone server ──
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/public-website/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/public-website/.next/static ./frontend/public-website/.next/static
RUN mkdir -p /app/config && chown node:node /app/config
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "frontend/public-website/server.js"]
