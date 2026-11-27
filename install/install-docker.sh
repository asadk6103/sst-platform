#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  SST Platform — Docker Compose installer (Linux / macOS)
#
#  Builds and starts the whole stack (PostgreSQL, API, website, admin portal, nginx) with
#  Docker Compose, waits until it is ready and prints the one-time setup code.
#  Optionally serves the site over HTTPS with an automatic Let's Encrypt certificate.
#
#  Run from the project folder:
#     ./install/install-docker.sh                     # http://<server>:8000/
#     sudo ./install/install-docker.sh --install-docker --port 80
#     ./install/install-docker.sh --domain www.school.pk --email it@school.pk   # HTTPS
#     ./install/install-docker.sh --shared-proxy --domain www.school.pk --email it@school.pk
#                                  # HTTPS when another SST application runs on the same server
#
#  Re-running the script upgrades the installation (rebuild + restart); data volumes are kept.
#  Settings given once (port, domain) are saved in .env and reused on later runs.
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

HTTP_PORT=""
INSTALL_DOCKER=0
DOMAIN=""
ACME_EMAIL=""
STAGING=0
NO_HTTPS=0
SHARED=0
SHARED_DIR=""
HTTPS_FILES="docker-compose.yml:docker-compose.https.yml"
SHARED_FILES="docker-compose.yml:docker-compose.shared-proxy.yml"
APP_NAME="sst-platform"
UPSTREAM="sst-platform-nginx:80"
LE_STAGING="https://acme-staging-v02.api.letsencrypt.org/directory"

usage() {
  cat <<'EOF'
Usage: ./install/install-docker.sh [options]

  --port N           Port on this machine that serves the site over plain HTTP
                     (default 8000, or the HTTP_PORT already saved in .env)
  --domain NAMES     Serve the site over HTTPS on ports 80/443 with a free, automatically
                     renewed Let's Encrypt certificate. Several names: "school.pk,www.school.pk"
  --email ADDRESS    Contact address for Let's Encrypt (required with --domain)
  --staging          Use Let's Encrypt's test service (untrusted certificate, for trial runs)
  --no-https         Turn HTTPS off again (back to plain HTTP on --port / 8000)
  --shared-proxy     Several SST applications on this server (e.g. SST Alumni Connect as well): use
                     one shared HTTPS proxy for ports 80/443 instead of a proxy per application.
                     Use together with --domain/--email (the other application's installer
                     takes the same option with its own domain)
  --shared-proxy-dir DIR  Folder of the shared proxy (default: ../sst-edge next to this project)
  --install-docker   Install Docker Engine + Compose plugin if missing (Linux, needs root)
  -h, --help         Show this help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port) HTTP_PORT="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) ACME_EMAIL="${2:-}"; shift 2 ;;
    --staging) STAGING=1; shift ;;
    --no-https) NO_HTTPS=1; shift ;;
    --shared-proxy) SHARED=1; shift ;;
    --shared-proxy-dir) SHARED_DIR="${2:-}"; shift 2 ;;
    --install-docker) INSTALL_DOCKER=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=; G=; Y=; R=; N=; fi
step() { echo; echo "${B}==> $*${N}"; }
info() { echo "    $*"; }
warn() { echo "${Y}WARNING:${N} $*" >&2; }
die()  { echo "${R}ERROR:${N} $*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f docker-compose.yml ] && grep -q '"name": "sst-platform"' package.json \
  || die "run the script from inside the SST project folder (install/install-docker.sh)."
if [ -n "$HTTP_PORT" ]; then
  [[ "$HTTP_PORT" =~ ^[0-9]+$ ]] && [ "$HTTP_PORT" -ge 1 ] && [ "$HTTP_PORT" -le 65535 ] || die "--port must be a number between 1 and 65535."
fi
if [ -n "$DOMAIN" ] && [ -z "$ACME_EMAIL" ]; then die "--domain needs --email (Let's Encrypt sends certificate notices there)."; fi
if [ -n "$ACME_EMAIL" ] && [ -z "$DOMAIN" ]; then die "--email needs --domain."; fi
if [ -n "$DOMAIN" ] && [ $NO_HTTPS = 1 ]; then die "--domain and --no-https cannot be combined."; fi
if [ $SHARED = 1 ] && [ $NO_HTTPS = 1 ]; then die "--shared-proxy and --no-https cannot be combined."; fi
# shellcheck source=install/shared-proxy.sh
. "$(dirname "${BASH_SOURCE[0]}")/shared-proxy.sh"
if [ -n "$DOMAIN" ]; then
  DOMAIN="$(echo "$DOMAIN" | tr -d ' ' | sed 's/,/, /g')"   # Caddy: "a.pk, www.a.pk"
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.,\ -]+$ ]] || die "--domain may only contain domain names separated by commas."
  [[ "$ACME_EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "--email is not a valid e-mail address."
fi

echo "${B}SST Platform — Docker Compose installer${N}"

# ── 1. Docker ────────────────────────────────────────────────────────────────
step "Checking Docker"
if ! command -v docker >/dev/null; then
  [ $INSTALL_DOCKER = 1 ] || die "Docker is not installed. Install Docker (https://docs.docker.com/engine/install/) or re-run with --install-docker (Linux)."
  [ "$(uname -s)" = Linux ] || die "--install-docker works on Linux only. Install Docker Desktop instead."
  [ "$(id -u)" -eq 0 ] || die "--install-docker needs root:  sudo $0 --install-docker"
  info "installing Docker Engine (get.docker.com)"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker >/dev/null 2>&1 || true
  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then
    usermod -aG docker "$SUDO_USER"
    info "added $SUDO_USER to the 'docker' group (takes effect at the next login)"
  fi
fi

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null && sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
    info "using sudo for Docker (add yourself to the 'docker' group to avoid this)"
  else
    die "Docker is installed but not running (or you lack permission). Start Docker and try again."
  fi
fi
"${DOCKER[@]}" compose version >/dev/null 2>&1 || die "the Docker Compose plugin is missing ('docker compose'). Install docker-compose-plugin."
info "$("${DOCKER[@]}" --version)"
info "$("${DOCKER[@]}" compose version)"
compose() { "${DOCKER[@]}" compose "$@"; }

# ── 2. optional .env (infrastructure only) ───────────────────────────────────
step "Preparing configuration"
set_env() { # set_env KEY VALUE — add or replace a line in .env
  touch .env
  if grep -q "^$1=" .env; then
    grep -v "^$1=" .env > .env.tmp || true
    mv .env.tmp .env
  fi
  printf '%s=%s\n' "$1" "$2" >> .env
}
del_env() { if [ -f .env ]; then grep -v "^$1=" .env > .env.tmp || true; mv .env.tmp .env; fi; }
get_env() { if [ -f .env ]; then sed -n "s/^$1=//p" .env | tail -n1 | tr -d '\r"'"'"; fi; }

if [ -n "$HTTP_PORT" ]; then set_env HTTP_PORT "$HTTP_PORT"; fi
HTTP_PORT="$(get_env HTTP_PORT)"; HTTP_PORT="${HTTP_PORT:-8000}"

WAS_SHARED=0
[ "$(get_env COMPOSE_FILE)" = "$SHARED_FILES" ] && WAS_SHARED=1
if [ -n "$DOMAIN" ]; then
  # Saved in .env so that every later `docker compose …` command keeps HTTPS enabled.
  # A server already using the shared proxy keeps it when only the domain changes.
  if [ $SHARED = 1 ] || [ $WAS_SHARED = 1 ]; then set_env COMPOSE_FILE "$SHARED_FILES"; else set_env COMPOSE_FILE "$HTTPS_FILES"; fi
  set_env COMPOSE_PATH_SEPARATOR ":"
  set_env DOMAIN "\"$DOMAIN\""
  set_env ACME_EMAIL "$ACME_EMAIL"
  if [ $STAGING = 1 ]; then set_env ACME_CA "$LE_STAGING"; else del_env ACME_CA; fi
elif [ $SHARED = 1 ]; then
  [ -n "$(get_env DOMAIN)" ] && [ -n "$(get_env ACME_EMAIL)" ] || die "--shared-proxy needs --domain and --email."
  set_env COMPOSE_FILE "$SHARED_FILES"
  set_env COMPOSE_PATH_SEPARATOR ":"
elif [ $NO_HTTPS = 1 ]; then
  for k in COMPOSE_FILE COMPOSE_PATH_SEPARATOR DOMAIN ACME_EMAIL ACME_CA; do del_env "$k"; done
  info "HTTPS turned off"
fi
HTTPS=0; SHARED_MODE=0
case "$(get_env COMPOSE_FILE)" in
  "$HTTPS_FILES") HTTPS=1 ;;
  "$SHARED_FILES") HTTPS=1; SHARED_MODE=1 ;;
esac
[ -n "$SHARED_DIR" ] && set_env SHARED_PROXY_DIR "$SHARED_DIR"
SHARED_DIR="$(get_env SHARED_PROXY_DIR)"
SHARED_DIR="${SHARED_DIR:-$(dirname "$ROOT")/sst-edge}"
DOMAIN="$(get_env DOMAIN)"
FIRST_DOMAIN="$(echo "${DOMAIN%%,*}" | tr -d ' ')"
if [ $HTTPS = 1 ]; then
  info "HTTPS with Let's Encrypt for: $DOMAIN$([ $SHARED_MODE = 1 ] && echo " (shared proxy in $SHARED_DIR)")$([ "$(get_env ACME_CA)" = "$LE_STAGING" ] && echo ' (staging)')"
fi

if "${DOCKER[@]}" volume inspect sst_pgdata >/dev/null 2>&1; then
  info "existing database found — keeping its password and data"
  if [ -z "$(get_env POSTGRES_PASSWORD)" ]; then
    info "(no POSTGRES_PASSWORD in .env: the database must have been created with the built-in default)"
  fi
elif [ -z "$(get_env POSTGRES_PASSWORD)" ]; then
  # New database: give it its own random password instead of the built-in default.
  set_env POSTGRES_PASSWORD "$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  info "generated a database password (saved in .env — keep this file)"
fi
[ -f .env ] && chmod 600 .env

port_busy() { command -v ss >/dev/null && ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"; }
if [ $HTTPS = 1 ]; then
  edge_running=0
  if [ $SHARED_MODE = 1 ]; then
    "${DOCKER[@]}" ps --filter "label=com.docker.compose.project=sst-edge" --filter status=running -q | grep -q . && edge_running=1
  else
    compose ps --status running https 2>/dev/null | grep -q https && edge_running=1
  fi
  if [ $edge_running = 0 ]; then
    for p in 80 443; do
      if port_busy $p; then warn "port $p is already in use by another program (another web server?). HTTPS needs ports 80 and 443."; fi
    done
  fi
  # Best-effort DNS check: Let's Encrypt can only issue the certificate if the domain points here.
  resolved="$(getent ahostsv4 "$FIRST_DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
  public_ip="$(curl -fsS -4 --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if [ -z "$resolved" ]; then
    warn "$FIRST_DOMAIN does not resolve yet. Create a DNS A record pointing to this server${public_ip:+ ($public_ip)}."
  elif [ -n "$public_ip" ] && ! echo " $resolved" | grep -q " $public_ip "; then
    warn "$FIRST_DOMAIN points to $resolved but this server's public IP is $public_ip — the certificate request fails until DNS is updated."
  fi
elif port_busy "$HTTP_PORT" && ! compose ps --status running nginx 2>/dev/null | grep -q nginx; then
  warn "port $HTTP_PORT is already in use by another program — choose another with --port."
fi

# ── 3. build and start ───────────────────────────────────────────────────────
step "Building and starting the containers (the first build takes several minutes)"
[ $SHARED_MODE = 1 ] && shared_proxy_network
compose up -d --build --remove-orphans

step "Waiting for the API (the first start loads the sample content)"
api_id="$(compose ps -q api)"
status=""
for _ in $(seq 1 120); do
  status="$("${DOCKER[@]}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_id" 2>/dev/null || echo unknown)"
  [ "$status" = healthy ] && break
  if [ "$status" = exited ] || [ "$status" = dead ]; then break; fi
  sleep 5
done
if [ "$status" != healthy ]; then
  compose logs --tail=60 api || true
  die "the API did not become healthy (status: $status). See the log above or:  docker compose logs api"
fi
info "API is healthy"

if [ $SHARED_MODE = 1 ]; then
  step "Registering $DOMAIN with the shared HTTPS proxy ($SHARED_DIR)"
  shared_proxy_register "$SHARED_DIR" "$APP_NAME" "$DOMAIN" "$UPSTREAM" "$(get_env ACME_EMAIL)" \
    "$([ "$(get_env ACME_CA)" = "$LE_STAGING" ] && echo 1 || echo 0)"
elif [ $WAS_SHARED = 1 ]; then
  shared_proxy_unregister "$SHARED_DIR" "$APP_NAME"
fi

if [ $HTTPS = 1 ]; then
  BASE="https://$FIRST_DOMAIN"
  step "Waiting for the Let's Encrypt certificate"
  ok=0
  for _ in $(seq 1 36); do
    if curl -fsS -o /dev/null --max-time 10 "$BASE/robots.txt" 2>/dev/null; then ok=1; break; fi
    sleep 5
  done
  if [ $ok = 1 ]; then
    info "certificate installed — renewed automatically before it expires"
  elif [ "$(get_env ACME_CA)" = "$LE_STAGING" ]; then
    info "staging certificate requested (browsers do not trust it). Re-run without --staging when ready."
  else
    if [ $SHARED_MODE = 1 ]; then LOGS="cd $SHARED_DIR && docker compose logs -f caddy"; "${DOCKER[@]}" compose --project-directory "$SHARED_DIR" -f "$SHARED_DIR/docker-compose.yml" logs --tail=40 caddy || true
    else LOGS="docker compose logs -f https"; compose logs --tail=40 https || true; fi
    warn "the certificate is not ready yet. Check that $FIRST_DOMAIN points to this server and that"
    warn "ports 80 and 443 are open in the firewall; Caddy keeps retrying. Follow:  $LOGS"
  fi
else
  HOST="localhost"
  if [ "$(uname -s)" = Linux ]; then HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"; HOST="${HOST:-localhost}"; fi
  PORT_SUFFIX=""; [ "$HTTP_PORT" != 80 ] && PORT_SUFFIX=":$HTTP_PORT"
  BASE="http://$HOST$PORT_SUFFIX"
fi

# ── done ─────────────────────────────────────────────────────────────────────
echo
echo "${G}${B}SST Platform is running.${N}"
echo "    Website:               $BASE/"
echo "    Administration portal: $BASE/admin/"
code="$(compose exec -T api cat config/setup-code.txt 2>/dev/null | tr -d '\r\n' || true)"
if [ -n "$code" ]; then
  echo
  echo "    ${B}First-run setup:${N} open the administration portal and enter this setup code:"
  echo
  echo "        ${B}$code${N}"
  echo
  echo "    (shown again any time with:  docker compose logs api)"
fi
cat <<EOF

    Status:     docker compose ps
    Logs:       docker compose logs -f api web
    Stop:       docker compose down          (data is kept in Docker volumes)
    Upgrade:    pull the new version, then run this script again
EOF
if [ $SHARED_MODE = 1 ]; then
  echo "    HTTPS:      shared proxy in $SHARED_DIR, certificates renew automatically"
  echo "                (logs: cd $SHARED_DIR && docker compose logs -f caddy)"
  echo "                In Administration → System, the public address should be $BASE"
elif [ $HTTPS = 1 ]; then
  echo "    HTTPS:      certificates renew automatically (docker compose logs https)"
  echo "                In Administration → System, the public address should be $BASE"
else
  echo "    HTTPS:      re-run with  --domain <your-domain> --email <address>"
fi
