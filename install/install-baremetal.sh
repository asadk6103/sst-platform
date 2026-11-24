#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  SST Platform — bare-metal installer (no Docker)
#
#  Supported: Ubuntu 22.04 / 24.04, Debian 12 (x86_64 or arm64), 2 GB RAM or more.
#
#  Installs Node.js 24, PostgreSQL, nginx, builds the API, website and administration
#  portal, and runs them as systemd services behind nginx:
#
#     /            → website      (sst-web.service, 127.0.0.1:3000)
#     /admin/      → admin portal (static files in <prefix>/www/admin)
#     /api/        → API          (sst-api.service, 127.0.0.1:4200)
#     /uploads/    → uploaded media (<prefix>/data/uploads)
#
#  Run from the project folder:
#     sudo ./install/install-baremetal.sh                       # http://<server>/
#     sudo ./install/install-baremetal.sh --domain school.pk --email you@school.pk   # + HTTPS
#
#  Re-running the script upgrades an existing installation (database backup, rebuild,
#  migrations, restart). Content, uploads, users and security keys are kept.
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

PREFIX=/opt/sst
DOMAIN=""
EMAIL=""
HTTP_PORT=80
SKIP_PACKAGES=0
SKIP_BACKUP=0

usage() {
  cat <<'EOF'
Usage: sudo ./install/install-baremetal.sh [options]

  --domain NAME      Domain name nginx answers to (default: any name / IP address)
  --email ADDRESS    With --domain: request a free Let's Encrypt HTTPS certificate
  --port N           HTTP port for nginx (default 80)
  --prefix DIR       Installation folder (default /opt/sst)
  --skip-packages    Do not install system packages (Node.js, PostgreSQL, nginx)
  --skip-backup      Upgrades: do not back up the database first
  -h, --help         Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --port) HTTP_PORT="${2:-}"; shift 2 ;;
    --prefix) PREFIX="${2:-}"; shift 2 ;;
    --skip-packages) SKIP_PACKAGES=1; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

# ── helpers ──────────────────────────────────────────────────────────────────
if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=; G=; Y=; R=; N=; fi
step() { echo; echo "${B}==> $*${N}"; }
info() { echo "    $*"; }
warn() { echo "${Y}WARNING:${N} $*" >&2; }
die()  { echo "${R}ERROR:${N} $*" >&2; exit 1; }
trap 'die "installation failed at line $LINENO (see the output above)."' ERR

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$PREFIX/app"
DATA="$PREFIX/data"
WWW="$PREFIX/www"
HOME_DIR="$PREFIX/home"
BACKUPS="$PREFIX/backups"
ETC=/etc/sst
ENV_FILE="$ETC/sst.env"
SVC_USER=sst
DB_NAME=sst
DB_USER=sst

[ "$(id -u)" -eq 0 ] || die "run this script as root, e.g.  sudo $0"
[ -f "$SRC/package.json" ] && grep -q '"name": "sst-platform"' "$SRC/package.json" \
  || die "run the script from inside the SST project folder (install/install-baremetal.sh)."
[[ "$HTTP_PORT" =~ ^[0-9]+$ ]] && [ "$HTTP_PORT" -ge 1 ] && [ "$HTTP_PORT" -le 65535 ] || die "--port must be a number between 1 and 65535."
if [ -n "$EMAIL" ] && [ -z "$DOMAIN" ]; then die "--email needs --domain (certificates are issued for a domain name)."; fi
if [ -n "$EMAIL" ] && [ "$HTTP_PORT" != 80 ]; then die "HTTPS certificates need nginx on port 80 (drop --port)."; fi

# shellcheck disable=SC1091
. /etc/os-release
case " ${ID:-} ${ID_LIKE:-} " in
  *" debian "*|*" ubuntu "*) ;;
  *) die "this installer supports Ubuntu and Debian. Detected: ${PRETTY_NAME:-unknown}." ;;
esac

UPGRADE=0
[ -f "$ENV_FILE" ] && UPGRADE=1

mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
swap_kb=$(awk '/SwapTotal/ {print $2}' /proc/meminfo)
if [ $(( mem_kb + swap_kb )) -lt 1900000 ]; then
  warn "less than 2 GB of memory (RAM + swap). Building the website may fail — add swap if it does."
fi

as_sst() {
  runuser -u "$SVC_USER" -- env HOME="$HOME_DIR" PATH="$PATH" \
    NEXT_TELEMETRY_DISABLED=1 SCARF_ANALYTICS=false CI=1 "$@"
}
pg() { (cd / && runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qtA "$@"); }

echo "${B}SST Platform — bare-metal installer${N}"
info "source:      $SRC"
info "install to:  $PREFIX"
info "mode:        $([ $UPGRADE = 1 ] && echo upgrade || echo new installation)"

# ── 1. system packages ───────────────────────────────────────────────────────
if [ $SKIP_PACKAGES = 0 ]; then
  step "Installing system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg rsync openssl nginx postgresql postgresql-contrib

  node_major=0
  command -v node >/dev/null && node_major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$node_major" -lt 20 ]; then
    info "installing Node.js 24 (NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y -q nodejs
  else
    info "Node.js $(node -v) already installed"
  fi
  if [ -n "$EMAIL" ]; then apt-get install -y -q certbot python3-certbot-nginx; fi
fi

command -v node >/dev/null || die "Node.js is not installed."
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node.js 20 or newer is required (found $(node -v))."
for c in npm psql nginx rsync openssl; do command -v "$c" >/dev/null || die "'$c' is not installed."; done
NODE_BIN="$(command -v node)"

systemctl enable --now postgresql >/dev/null
systemctl enable nginx >/dev/null

# ── 2. service account and folders ───────────────────────────────────────────
step "Preparing the service account and folders"
if ! id "$SVC_USER" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$HOME_DIR" --shell /usr/sbin/nologin "$SVC_USER"
  info "created system user '$SVC_USER'"
fi
install -d -m 755 "$PREFIX" "$WWW"
install -d -m 755 -o "$SVC_USER" -g "$SVC_USER" "$APP" "$HOME_DIR" "$DATA" "$DATA/uploads"
install -d -m 700 -o "$SVC_USER" -g "$SVC_USER" "$DATA/config" "$DATA/private-uploads"
install -d -m 700 "$BACKUPS"
install -d -m 750 -g "$SVC_USER" "$ETC"

# ── 3. database ──────────────────────────────────────────────────────────────
step "Configuring PostgreSQL"
DB_PASSWORD=""
if [ -f "$ENV_FILE" ]; then
  DB_PASSWORD=$(sed -n "s#^DATABASE_URL=postgresql://$DB_USER:\([^@]*\)@.*#\1#p" "$ENV_FILE")
fi
[ -n "$DB_PASSWORD" ] || DB_PASSWORD=$(openssl rand -hex 24)

if [ "$(pg -c "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'")" = 1 ]; then
  pg -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD'"
else
  pg -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD'"
  info "created database role '$DB_USER'"
fi
DB_EXISTS=0
if [ "$(pg -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")" = 1 ]; then
  DB_EXISTS=1
else
  (cd / && runuser -u postgres -- createdb -O "$DB_USER" -E UTF8 -T template0 "$DB_NAME")
  info "created database '$DB_NAME'"
fi

# Only infrastructure settings live here. Security keys are generated by the API on first start
# (in $DATA/config); everything else is configured in the administration portal.
umask 027
cat > "$ENV_FILE" <<EOF
# SST Platform — written by install/install-baremetal.sh. Infrastructure settings only:
# the administrator, public address, upload limit and security keys are managed in the
# administration portal (first-run setup wizard, then Administration → System).
NODE_ENV=production
PORT=4200
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME?schema=public
CONFIG_DIR=$DATA/config
UPLOAD_DIR=$DATA/uploads
REVALIDATE_URL=http://127.0.0.1:3000/cms-hooks/revalidate
TRUST_PROXY=1
EOF
umask 022
chown root:"$SVC_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

if [ $UPGRADE = 1 ] && [ $DB_EXISTS = 1 ] && [ $SKIP_BACKUP = 0 ]; then
  BACKUP_FILE="$BACKUPS/sst-$(date +%Y%m%d-%H%M%S).dump"
  (cd / && runuser -u postgres -- pg_dump -Fc "$DB_NAME") > "$BACKUP_FILE"
  info "database backed up to $BACKUP_FILE"
fi

# ── 4. application files ─────────────────────────────────────────────────────
step "Copying the application"
for s in sst-web sst-api; do
  if systemctl is-active --quiet "$s" 2>/dev/null; then systemctl stop "$s"; info "stopped $s for the upgrade"; fi
done
if [ "$SRC" != "$APP" ]; then
  rsync -a --delete \
    --exclude '.git/' --exclude 'node_modules/' --exclude '.env' --exclude '.next/' --exclude 'dist/' \
    --exclude '*.tsbuildinfo' --exclude '/backend/config/' --exclude '/backend/uploads/' \
    --exclude '/backend/private-uploads/' --exclude '/documentation/screenshots/' \
    "$SRC/" "$APP/"
fi
chown -R "$SVC_USER:$SVC_USER" "$APP"

# ── 5. build ─────────────────────────────────────────────────────────────────
step "Installing dependencies (this takes a few minutes)"
cd "$APP"
as_sst npm ci --no-audit --no-fund

step "Building the API"
as_sst npm run build --workspace backend

step "Building the administration portal"
as_sst npm run build --workspace admin-portal
rsync -a --delete "$APP/frontend/admin-portal/dist/" "$WWW/admin/"
install -m 644 "$APP/infrastructure/nginx/html/__unavailable.html" "$WWW/__unavailable.html"

step "Building the website"
WEB="$APP/frontend/public-website"
as_sst env API_INTERNAL_URL=http://127.0.0.1:4200 npm run build --workspace public-website
WEB_RUN="$WEB/.next/standalone/frontend/public-website"
[ -f "$WEB_RUN/server.js" ] || die "website build did not produce $WEB_RUN/server.js"
as_sst rm -rf "$WEB_RUN/.next/static" "$WEB_RUN/public"
as_sst cp -r "$WEB/.next/static" "$WEB_RUN/.next/static"
if [ -d "$WEB/public" ]; then as_sst cp -r "$WEB/public" "$WEB_RUN/public"; fi

PRISMA_BIN=""
for p in "$APP/node_modules/.bin/prisma" "$APP/backend/node_modules/.bin/prisma"; do
  if [ -x "$p" ]; then PRISMA_BIN="$p"; break; fi
done
[ -n "$PRISMA_BIN" ] || die "Prisma CLI not found after npm ci."

# ── 6. systemd services ──────────────────────────────────────────────────────
step "Installing systemd services"
cat > /etc/systemd/system/sst-api.service <<EOF
[Unit]
Description=SST Platform API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$APP/backend
EnvironmentFile=$ENV_FILE
Environment=HOME=$HOME_DIR SCARF_ANALYTICS=false
# Same start-up as the Docker image: apply migrations, run the idempotent seed, start the API.
ExecStartPre=$PRISMA_BIN migrate deploy
ExecStartPre=$NODE_BIN dist/seed.js
ExecStart=$NODE_BIN dist/server.js
Restart=on-failure
RestartSec=5
TimeoutStartSec=900
UMask=0022
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/sst-web.service <<EOF
[Unit]
Description=SST Platform public website
After=network-online.target sst-api.service
Wants=network-online.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$WEB_RUN
Environment=NODE_ENV=production PORT=3000 HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1
Environment=API_INTERNAL_URL=http://127.0.0.1:4200 CONFIG_DIR=$DATA/config HOME=$HOME_DIR
ExecStart=$NODE_BIN server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable sst-api sst-web >/dev/null

# ── 7. nginx ─────────────────────────────────────────────────────────────────
step "Configuring nginx"
cat > /etc/nginx/snippets/sst-headers.conf <<'EOF'
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
EOF

SERVER_NAME="${DOMAIN:-_}"
LISTEN_OPTS=""
[ -z "$DOMAIN" ] && LISTEN_OPTS=" default_server"
SITE=/etc/nginx/sites-available/sst.conf
# A fresh certbot run edits this file to add HTTPS, so keep it if it already holds a certificate.
if [ -f "$SITE" ] && grep -q "managed by Certbot" "$SITE"; then
  info "keeping $SITE (it contains the HTTPS settings added by certbot)"
else
  cat > "$SITE" <<EOF
# SST Platform — written by install/install-baremetal.sh
map \$http_upgrade \$sst_connection_upgrade { default upgrade; '' close; }

server {
  listen $HTTP_PORT$LISTEN_OPTS;
  listen [::]:$HTTP_PORT$LISTEN_OPTS;
  server_name $SERVER_NAME;

  server_tokens off;
  client_max_body_size 101m;   # the API enforces the limit set in Administration → System
  root $WWW;

  gzip on;
  gzip_comp_level 5;
  gzip_min_length 1024;
  gzip_types text/plain text/css application/json application/javascript text/javascript image/svg+xml application/xml;

  include snippets/sst-headers.conf;

  proxy_http_version 1.1;
  proxy_set_header Host              \$host;
  proxy_set_header X-Real-IP         \$remote_addr;
  proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_set_header Upgrade           \$http_upgrade;
  proxy_set_header Connection        \$sst_connection_upgrade;

  error_page 502 503 504 /__unavailable.html;
  location = /__unavailable.html { internal; }

  location /api/ {
    proxy_pass http://127.0.0.1:4200;
    proxy_read_timeout 120s;
  }

  location /uploads/ {
    alias $DATA/uploads/;
    expires 30d;
    include snippets/sst-headers.conf;
    add_header Cache-Control "public" always;
    try_files \$uri =404;
  }

  location = /admin { return 301 /admin/; }
  location /admin/assets/ {
    expires 1y;
    include snippets/sst-headers.conf;
    add_header Cache-Control "public, immutable" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    try_files \$uri =404;
  }
  location /admin/ {
    include snippets/sst-headers.conf;
    add_header Cache-Control "no-cache" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    try_files \$uri \$uri/ /admin/index.html;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
EOF
fi
ln -sf "$SITE" /etc/nginx/sites-enabled/sst.conf
if [ -z "$DOMAIN" ] && [ -L /etc/nginx/sites-enabled/default ] && grep -qE "listen\s+$HTTP_PORT\s+default_server" /etc/nginx/sites-available/default 2>/dev/null; then
  rm /etc/nginx/sites-enabled/default
  info "disabled nginx's default welcome site (it also claimed port $HTTP_PORT)"
fi
nginx -t 2>&1 | sed 's/^/    /'
systemctl reload-or-restart nginx

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$HTTP_PORT/tcp" >/dev/null
  if [ -n "$EMAIL" ]; then ufw allow 443/tcp >/dev/null; fi
  info "firewall (ufw): opened port $HTTP_PORT$([ -n "$EMAIL" ] && echo ' and 443')"
fi

# ── 8. start ─────────────────────────────────────────────────────────────────
step "Starting the services (the first start loads the sample content — allow a few minutes)"
systemctl restart sst-api || die "the API did not start. Check:  journalctl -u sst-api -n 100 --no-pager"
systemctl restart sst-web
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null http://127.0.0.1:4200/api/health && curl -fsS -o /dev/null http://127.0.0.1:3000/robots.txt; then break; fi
  sleep 2
done
sleep 2   # the setup code is written just after the API starts listening
curl -fsS -o /dev/null http://127.0.0.1:4200/api/health || die "the API is not answering. Check:  journalctl -u sst-api -n 100 --no-pager"
curl -fsS -o /dev/null http://127.0.0.1:3000/robots.txt || warn "the website is not answering yet. Check:  journalctl -u sst-web -n 100 --no-pager"

# ── 9. HTTPS (optional) ──────────────────────────────────────────────────────
SCHEME=http
if [ -n "$EMAIL" ]; then
  step "Requesting an HTTPS certificate for $DOMAIN"
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
    SCHEME=https
  else
    warn "certbot failed — the site is available over HTTP. Make sure $DOMAIN points to this server, then run:"
    warn "  sudo certbot --nginx -d $DOMAIN --redirect"
  fi
fi

# ── done ─────────────────────────────────────────────────────────────────────
if [ -n "$DOMAIN" ]; then HOST="$DOMAIN"; else HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"; HOST="${HOST:-localhost}"; fi
PORT_SUFFIX=""
if { [ "$SCHEME" = http ] && [ "$HTTP_PORT" != 80 ]; }; then PORT_SUFFIX=":$HTTP_PORT"; fi
BASE="$SCHEME://$HOST$PORT_SUFFIX"

echo
echo "${G}${B}SST Platform is installed.${N}"
echo "    Website:               $BASE/"
echo "    Administration portal: $BASE/admin/"
if [ -f "$DATA/config/setup-code.txt" ]; then
  echo
  echo "    ${B}First-run setup:${N} open the administration portal and enter this setup code:"
  echo
  echo "        ${B}$(cat "$DATA/config/setup-code.txt")${N}"
  echo
  echo "    (shown again any time with:  sudo cat $DATA/config/setup-code.txt)"
fi
cat <<EOF

    Services:   systemctl status sst-api sst-web
    Logs:       journalctl -u sst-api -f      journalctl -u sst-web -f
    Upgrade:    pull the new version, then run this script again
    Data:       database '$DB_NAME', uploads in $DATA/uploads, keys in $DATA/config
    Backups:    $BACKUPS (taken before each upgrade)
EOF
