# SST Administration Portal (build context: repository root)
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/admin-portal/package.json frontend/admin-portal/
COPY frontend/public-website/package.json frontend/public-website/
RUN npm ci --workspace admin-portal --workspace @sst/shared --include-workspace-root --no-audit --no-fund

# ── development: Vite dev server with hot reload (source bind-mounted) ──
FROM deps AS dev
WORKDIR /app/frontend/admin-portal
EXPOSE 80
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "80", "--strictPort"]

# ── production build ──
FROM deps AS build
COPY packages/shared packages/shared
COPY frontend/admin-portal frontend/admin-portal
RUN npm run build --workspace admin-portal

# ── static runtime ──
FROM nginx:1.27-alpine AS runtime
COPY infrastructure/nginx/admin.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/admin-portal/dist /usr/share/nginx/html/admin
RUN nginx -t
EXPOSE 80
