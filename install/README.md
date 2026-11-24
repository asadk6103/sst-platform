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
