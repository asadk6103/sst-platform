# Installing the SST Platform

Two installers are available. Neither needs a `.env` file. After installation, open
`/admin/` and complete the first-run setup wizard with the **setup code** the installer prints.

| | Docker Compose | Bare metal |
|---|---|---|
| Script | `install-docker.sh` (Linux/macOS), `install-docker.ps1` (Windows) | `install-baremetal.sh` |
| Runs on | any machine with Docker | Ubuntu 22.04 / 24.04, Debian 12 |
| Installs | Docker Engine (Linux, optional `--install-docker`) | Node.js 24, PostgreSQL, nginx, systemd services |
| Default address | `http://<server>:8000/` | `http://<server>/` |
| HTTPS (Let's Encrypt, auto-renewed) | `--domain` + `--email` | `--domain` + `--email` |

## Docker Compose

```bash
./install/install-docker.sh                 # Linux / macOS
./install/install-docker.sh --port 80       # serve on port 80
sudo ./install/install-docker.sh --install-docker   # fresh Linux server without Docker
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1            # Windows
powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1 -Port 80
```

### HTTPS with Let's Encrypt (Docker)

```bash
./install/install-docker.sh --domain www.school.pk --email it@school.pk
./install/install-docker.sh --domain "school.pk,www.school.pk" --email it@school.pk   # several names
./install/install-docker.sh --domain www.school.pk --email it@school.pk --staging     # trial run
./install/install-docker.sh --no-https                                               # turn it off
./install/install-docker.sh --shared-proxy --domain www.school.pk --email it@school.pk   # another SST app on this server
```

Before you run it:
1. Point the domain's DNS **A record** at the server's public IP.
2. Make sure ports **80 and 443** are open in the firewall and router, and that no other web server uses them.

The installer adds a Caddy container (`docker-compose.https.yml`). It:
- gets the certificate from Let's Encrypt and renews it automatically;
- redirects `http://` to `https://`;
- adds HSTS.

Certificates are stored in the `caddy_data` volume.

The installer also saves `COMPOSE_FILE`, `DOMAIN` and `ACME_EMAIL` in `.env`, so plain `docker compose up -d` keeps HTTPS on.
With HTTPS on, the site is served only on ports 80 and 443, and port 8000 is closed.
Watch the certificate requests with `docker compose logs -f https`.

On Windows use `-Domain`, `-Email`, `-Staging` and `-NoHttps`.

Requires Docker Compose 2.24 or newer.

On a **new** installation, the script writes a random `POSTGRES_PASSWORD` to `.env`. Keep that file.
If a database volume already exists, its password is left unchanged.

## Several SST applications on one server

The SST Platform website and SST Alumni Connect can share one server, each with its own domain. Only one
program can use ports 80/443, so both applications use **one shared HTTPS proxy** (Caddy, project `sst-edge`).
It gets a Let's Encrypt certificate for every domain and forwards each domain to its application:

```
internet ──80/443──► sst-edge ──┬─ sstpsr.duckdns.org          ──► SST Platform nginx        (127.0.0.1:8000)
                                └─ sstpsr-connect.duckdns.org  ──► SST Alumni Connect nginx  (127.0.0.1:8080)
```

Clone both projects next to each other (e.g. `/opt/sst-platform` and `/opt/sst-alumni-connect`), then:

```bash
cd /opt/sst-platform
./install/install-docker.sh --shared-proxy --domain sstpsr.duckdns.org --email it@school.pk

cd /opt/sst-alumni-connect
./install/install-docker.sh --shared-proxy --domain sstpsr-connect.duckdns.org --email it@school.pk
```

Either order works. The proxy lives in `/opt/sst-edge` (`--shared-proxy-dir DIR` to change it; use the same folder for
both). Each installer adds its own `sites/<app>.caddy` file and reloads the proxy without interrupting the other site.

- Both domain names must point to the server (DuckDNS: set the IP for each subdomain).
- Open TCP 80 and 443 (and UDP 443) in the firewall. Ports 8000 and 8080 are bound to 127.0.0.1 only.
- Don't use `--domain` without `--shared-proxy` on this server, because that starts a second proxy.
- After the setup wizard, set **Administration → System → public address** to `https://sstpsr.duckdns.org`.

Full description, including the port table: SST Alumni Connect's `install/README.md`.
`install/shared-proxy.sh` is shared by both projects, so keep the two copies identical.

## Bare metal

```bash
sudo ./install/install-baremetal.sh                                           # http://<server-ip>/
sudo ./install/install-baremetal.sh --domain www.school.pk --email it@school.pk   # with HTTPS
```

| Item | Location |
|---|---|
| Application | `/opt/sst/app` (services run as the `sst` user) |
| Uploads | `/opt/sst/data/uploads`; private CVs in `/opt/sst/data/private-uploads` |
| Security keys, setup code | `/opt/sst/data/config` |
| Database connection | `/etc/sst/sst.env` (database `sst`, random password) |
| Admin portal files | `/opt/sst/www/admin` |
| nginx site | `/etc/nginx/sites-available/sst.conf` |
| Database backups | `/opt/sst/backups` (taken automatically before each upgrade) |

```bash
systemctl status sst-api sst-web
journalctl -u sst-api -f
sudo cat /opt/sst/data/config/setup-code.txt
```

## Upgrading

Update the project folder to the new version, then run the same installer again.
- **Docker:** rebuilds the images. Data volumes are kept.
- **Bare metal:**
  1. Backs up the database.
  2. Rebuilds the application.
  3. Applies migrations and restarts the services.

  During the rebuild, nginx shows a "back shortly" page.
