#!/bin/sh
# Applies database migrations, runs the (idempotent) seed, then starts the API.
#  - The seed always synchronises roles/permissions and creates the first super administrator.
#  - Website content is only inserted into an empty database.
set -e
MODE="${1:-prod}"
cd /app/backend

echo "[entrypoint] applying database migrations…"
npx prisma migrate deploy

if [ "$MODE" = "dev" ]; then
  npx prisma generate >/dev/null
  echo "[entrypoint] seeding (dev)…"
  npx tsx prisma/seed.ts
  echo "[entrypoint] starting API with hot reload…"
  # Polling watcher: file events from Windows/macOS bind mounts are not always delivered.
  exec npx nodemon --legacy-watch --watch src --watch ../packages/shared/src --ext ts,json --exec "tsx src/server.ts"
fi

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] seeding…"
  node dist/seed.js
fi
echo "[entrypoint] starting API…"
exec node dist/server.js
