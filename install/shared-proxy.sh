# shellcheck shell=bash
# ─────────────────────────────────────────────────────────────────────────────
#  Shared HTTPS proxy for several SST applications on one server (sourced by install-docker.sh).
#  The same file ships with SST Platform and SST Alumni Connect — keep both copies identical.
#
#  One Caddy container (Compose project "sst-edge", folder $SHARED_PROXY_DIR) owns ports 80/443,
#  obtains and renews a Let's Encrypt certificate for every registered domain, and forwards each
#  domain to its application's nginx over the Docker network "sst-edge":
#
#     <dir>/docker-compose.yml     the Caddy service (written by the installers)
#     <dir>/Caddyfile              global options + "import sites/*.caddy"
#     <dir>/sites/<app>.caddy      one file per application (written by that application's installer)
#
#  Requires the caller to define: DOCKER (array), info, warn, die.
# ─────────────────────────────────────────────────────────────────────────────

SHARED_PROXY_NETWORK=sst-edge
SHARED_PROXY_IMAGE=caddy:2.8.4-alpine
SHARED_PROXY_STAGING_CA=https://acme-staging-v02.api.letsencrypt.org/directory

shared_proxy_network() {  # create the shared Docker network once
  "${DOCKER[@]}" network inspect "$SHARED_PROXY_NETWORK" >/dev/null 2>&1 \
    || { "${DOCKER[@]}" network create "$SHARED_PROXY_NETWORK" >/dev/null && info "created Docker network '$SHARED_PROXY_NETWORK'"; }
}

# shared_proxy_register DIR APP DOMAINS UPSTREAM EMAIL STAGING(0|1)
#   DOMAINS: "a.pk, www.a.pk"   UPSTREAM: network alias:port of the application's nginx
shared_proxy_register() {
  local dir=$1 app=$2 domains=$3 upstream=$4 email=$5 staging=$6
  mkdir -p "$dir/sites" || die "cannot create $dir (choose another folder with --shared-proxy-dir)."
  cat > "$dir/docker-compose.yml" <<EOF
# Shared HTTPS proxy for the SST applications on this server — written by the installers.
# Sites: sites/*.caddy (one per application). Logs: docker compose logs -f caddy
name: sst-edge

services:
  caddy:
    image: $SHARED_PROXY_IMAGE
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./sites:/etc/caddy/sites:ro
      - caddy_data:/data          # certificates and ACME account — keep this volume
      - caddy_config:/config
    networks: [$SHARED_PROXY_NETWORK]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

networks:
  $SHARED_PROXY_NETWORK:
    external: true
    name: $SHARED_PROXY_NETWORK

volumes:
  caddy_data:
  caddy_config:
EOF
  cat > "$dir/Caddyfile" <<EOF
# Shared HTTPS proxy — written by the SST installers. One file per application in sites/.
{
	email $email
}

import sites/*.caddy
EOF
  local tls=""
  [ "$staging" = 1 ] && tls=$'\n\ttls {\n\t\tca '"$SHARED_PROXY_STAGING_CA"$'\n\t}'
  cat > "$dir/sites/$app.caddy" <<EOF
# $app — written by its installer
$domains {$tls
	header Strict-Transport-Security "max-age=31536000"
	reverse_proxy $upstream {
		flush_interval -1
	}
}
EOF
  local edge=("${DOCKER[@]}" compose --project-directory "$dir" -f "$dir/docker-compose.yml")
  "${edge[@]}" up -d >/dev/null || die "the shared HTTPS proxy did not start (ports 80/443 in use by another program?)."
  # pick up new or changed sites without dropping connections
  "${edge[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 \
    || "${edge[@]}" restart caddy >/dev/null
  info "shared HTTPS proxy: $domains → $upstream  (sites: $(cd "$dir/sites" && ls -- *.caddy | sed 's/\.caddy$//' | tr '\n' ' '))"
}

shared_proxy_unregister() {  # shared_proxy_unregister DIR APP
  local dir=$1 app=$2
  [ -f "$dir/sites/$app.caddy" ] || return 0
  rm -f -- "$dir/sites/$app.caddy"
  "${DOCKER[@]}" compose --project-directory "$dir" -f "$dir/docker-compose.yml" exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
  info "removed $app from the shared HTTPS proxy"
}
