# SST Platform

Public website, administration portal and content-management API for
**Sargodhan Spirit Trust Public School (SST), Rashidabad**.

| Part | Folder | Technology |
|---|---|---|
| Public website | `frontend/public-website` | Next.js |
| Administration portal (`/admin/`) | `frontend/admin-portal` | React + Vite |
| REST API (`/api/`) | `backend` | Node.js, Express, Prisma, PostgreSQL |
| Shared definitions | `packages/shared` | TypeScript |
| Docker / nginx | `infrastructure`, `docker-compose*.yml` | |

## Installation

Full guide: **[install/README.md](install/README.md)**

No `.env` file is needed. After installing, open `/admin/` and enter the **setup code** the
installer prints. The setup wizard creates the first administrator and sets the school name,
public address and colour theme. You can change these later under
**Administration → System**.

### Docker Compose

```bash
./install/install-docker.sh                                              # http://<server>:8000/
./install/install-docker.sh --domain www.school.pk --email it@school.pk   # HTTPS (Let's Encrypt)
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1    # Windows (Docker Desktop)
powershell -ExecutionPolicy Bypass -File .\install\install-docker.ps1 -Domain www.school.pk -Email it@school.pk
```

For HTTPS:
- Point the domain's DNS at the server.
- Open ports 80 and 443.

The certificate is then obtained and renewed automatically. To test the setup first, add `--staging`.

### Bare metal (Ubuntu 22.04 / 24.04, Debian 12)

```bash
sudo ./install/install-baremetal.sh                                            # http://<server-ip>/
sudo ./install/install-baremetal.sh --domain www.school.pk --email it@school.pk   # with HTTPS
```

### Upgrading

Update the project folder, then run the same installer again. Content, uploads, users and
keys are kept. Bare-metal upgrades back up the database first.

## Day-to-day (Docker)

```bash
docker compose ps                     # status
docker compose logs -f api web        # logs
docker compose logs api               # shows the setup code again (fresh installs)
docker compose down                   # stop (data stays in Docker volumes)
```

Development with hot reload: `npm run dev` (uses `docker-compose.dev.yml`).
