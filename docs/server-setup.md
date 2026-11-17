# Server setup (home server)

This guide installs Kamogawa Dashboard on a Linux machine and keeps it up to date
automatically. It takes about 20 minutes and needs no programming.

## How deployment works

```
push to main ──► GitHub Actions ──► tests pass? ──► build images ──► ghcr.io
                                                                       ▲
home server:  Watchtower checks every 5 minutes ───────────────────────┘
              new image? ─► pull it ─► restart the app containers
```

- **GitHub Actions** (`.github/workflows/ci-cd.yml`) runs on GitHub's own machines. On every
  push to `main` it runs the backend and frontend tests and, only if they pass, publishes two
  images to GitHub Container Registry (GHCR):
  `ghcr.io/kundlatsch/kamogawa-dashboard-backend` and `...-frontend`, each tagged `latest`
  and `sha-<commit>`.
- **The server never receives connections from GitHub.** It *pulls*: the Watchtower
  container polls GHCR and, when `latest` changes, downloads the image and recreates the
  backend, scheduler and frontend containers. The database container is never touched.
- On start, the backend applies database migrations by itself, so an update needs no
  manual step. Migrations are additive and keep existing data.

Nothing on the server needs the source code: only `docker-compose.prod.yml` and a `.env`.

## 1. Requirements

- A 64-bit Linux machine that stays on (Ubuntu Server 24.04 or Debian 12 recommended;
  x86-64 or ARM64 such as a Raspberry Pi 4/5), 2 GB of RAM, 10 GB of free disk.
- Internet access (outgoing only; no router ports need to be opened).
- Its LAN IP fixed, so phones always find it: reserve it in the router's DHCP settings.
  The examples below use `192.168.0.10`.

## 2. Install Docker

Docker's convenience script installs Docker Engine and the Compose plugin:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # run docker without sudo
```

Log out and back in, then check:

```bash
docker run --rm hello-world
docker compose version            # must be v2.24 or newer
```

Docker starts on boot by default, and every app container uses `restart: unless-stopped`,
so the app comes back by itself after a power cut.

## 3. Get the deployment files

```bash
mkdir -p ~/kamogawa && cd ~/kamogawa
BASE=https://raw.githubusercontent.com/kundlatsch/kamogawa-dashboard/main
curl -fsSLO "$BASE/docker-compose.prod.yml"
curl -fsSL "$BASE/.env.prod.example" -o .env
chmod 600 .env                    # only your user can read the secrets
```

## 4. Configure `.env`

Open it with `nano .env` and replace every `change-me`:

| Setting | What to put |
|---|---|
| `POSTGRES_PASSWORD` | output of `openssl rand -base64 24` |
| `DJANGO_SECRET_KEY` | output of `openssl rand -base64 48` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | the first login (the account admin) |
| `DJANGO_ALLOWED_HOSTS` | keep `localhost,127.0.0.1,backend`, then add the server's IP and any other name used to open the app |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | the full address, e.g. `http://192.168.0.10:8088` |
| `TZ` | the gym's time zone; check-in deadlines and the Sunday 23:00 job use it |

Never change `POSTGRES_PASSWORD` after the first start: the database keeps the first one.

## 5. Make the images public (once)

GHCR creates new packages as **private**, even for a public repository. After the first
successful CI run on `main`, the repository owner opens each package
(GitHub profile → **Packages** → `kamogawa-dashboard-backend` → **Package settings** →
**Change visibility** → **Public**) and repeats it for `kamogawa-dashboard-frontend`.
Public images need no login on the server.

<details>
<summary>Keeping the images private instead</summary>

Create a GitHub personal access token (classic) with only the `read:packages` scope, then
on the server:

```bash
echo "<token>" | docker login ghcr.io -u <github-username> --password-stdin
```

In `docker-compose.prod.yml`, uncomment the `config.json` volume line of the `watchtower`
service so Watchtower can use the same login.
</details>

## 6. Start

```bash
cd ~/kamogawa
docker compose up -d     # .env sets COMPOSE_FILE, so no -f is needed
docker compose ps        # wait until backend and frontend show "(healthy)"
```

The first start downloads the images and runs all migrations, so it can take a few minutes.
Then open `http://192.168.0.10:8088` from any device on the network, log in as the account
admin, create the gym and its coaches under **Academias**, and hand the coaches their
generated passwords.

## Day to day

| Task | Command (inside `~/kamogawa`) |
|---|---|
| See what is running | `docker compose ps` |
| Follow the logs | `docker compose logs -f backend` (or `scheduler`, `frontend`, `watchtower`) |
| See what Watchtower updated | `docker compose logs watchtower` |
| Update right now | `docker compose pull && docker compose up -d` |
| Pause automatic updates | `docker compose stop watchtower` (`start` to resume) |
| Restart everything | `docker compose restart` |
| Stop everything | `docker compose down` (data stays in the volumes) |

**Rolling back.** Every image is also tagged with its commit, e.g. `sha-1a2b3c4` (see the
repository's **Packages** page or the CI run). Set `IMAGE_TAG=sha-1a2b3c4` in `.env` and run
`docker compose up -d`. Watchtower then stays on that version; set `IMAGE_TAG=latest` again
to resume automatic updates. Rolling back does not undo database migrations.

**Updating the deployment files.** Watchtower updates images, not `docker-compose.prod.yml`.
When that file changes in the repository, download it again (step 3, first `curl` only)
and run `docker compose up -d`.

## Backups (optional, recommended)

Set `COMPOSE_PROFILES=backup` in `.env` and run `docker compose up -d`. Every night at
`BACKUP_AT` (default 03:00) the `backup` service writes into `BACKUP_DIR` (default
`~/kamogawa/backups`):

- `db_<date>.dump`: the whole database (`pg_dump` custom format)
- `media_<date>.tar.gz`: profile photos and uploaded images

Files older than `BACKUP_KEEP_DAYS` (default 14) are deleted. A backup on the same disk
does not survive a dead disk: copy the folder elsewhere from time to time, for example
`scp -r user@192.168.0.10:kamogawa/backups ./`.

Restore (this replaces the current data):

```bash
cd ~/kamogawa
docker compose stop backend scheduler
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < backups/db_2026-11-17_0300.dump
docker compose run --rm --no-deps -v "$PWD/backups:/backups:ro" --entrypoint sh backend \
  -c 'tar -xzf /backups/media_2026-11-17_0300.tar.gz -C /app/media'
docker compose start backend scheduler
```

## Access from outside the gym network (optional)

The app speaks plain HTTP on the local network. Pick one of these to reach it from
anywhere; neither needs open router ports.

### Tailscale: private access for a few people

Good when only the coaches need remote access. Everyone joins the same private network.

1. Install on the server: `curl -fsSL https://tailscale.com/install.sh | sh`, then
   `sudo tailscale up` and open the printed link to sign in.
2. Install the Tailscale app on each coach's phone or laptop and sign in to the same account
   (or share the server from the Tailscale admin console).
3. Find the server's name with `tailscale status` (e.g. `homeserver`), add it to
   `DJANGO_ALLOWED_HOSTS`, add `http://homeserver:8088` to `DJANGO_CSRF_TRUSTED_ORIGINS`,
   and run `docker compose up -d`.
4. Open `http://homeserver:8088`.

### Cloudflare Tunnel: public HTTPS address for everyone

Good when students should open the app from their own phones. Needs a domain managed by
Cloudflare (free plan is enough).

1. In the Cloudflare dashboard go to **Zero Trust → Networks → Tunnels → Create a tunnel**,
   choose **Cloudflared**, name it, and pick **Docker** as the environment. Copy the token
   from the command shown (the long string after `--token`).
2. Add a **public hostname**, e.g. `boxe.example.com`, with service type `HTTP` and URL
   `frontend:80` (the tunnel runs inside the same Docker network as the app).
3. In `.env`: set `CLOUDFLARE_TUNNEL_TOKEN=<token>`, add `tunnel` to `COMPOSE_PROFILES`
   (e.g. `COMPOSE_PROFILES=backup,tunnel`), add `boxe.example.com` to
   `DJANGO_ALLOWED_HOSTS` and `https://boxe.example.com` to `DJANGO_CSRF_TRUSTED_ORIGINS`.
4. `docker compose up -d`, then open `https://boxe.example.com`.

Cloudflare provides the HTTPS certificate. The app is then on the public internet, so use
strong passwords for the admin and the coaches.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Bad Request (400)` in the browser | The address you typed is missing from `DJANGO_ALLOWED_HOSTS`. Add it and `docker compose up -d`. |
| `backend` never becomes healthy | `docker compose logs backend`: usually a wrong `POSTGRES_PASSWORD`, or `localhost` removed from `DJANGO_ALLOWED_HOSTS` (the healthcheck uses it). |
| `pull access denied` / `denied` from GHCR | The packages are still private (step 5). |
| Watchtower logs say nothing changed after a push | Check the CI run on GitHub's **Actions** tab: images are only published when all tests pass. |
| Times or absences are off by hours | `TZ` in `.env`. |
| `502 Bad Gateway` for a minute after an update | Normal while the new backend runs migrations and starts; it clears by itself. |
