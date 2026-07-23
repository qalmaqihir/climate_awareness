# Deploy Runbook — Hostinger VPS

Covers Phase 0 tasks 0.8 – 0.12. Run these on the VPS as the user with Docker + sudo access. Every command is idempotent unless flagged.

**Assumed already on VPS:** Docker Engine, Docker Compose v2, Nginx Proxy Manager (NPM), Cloudflare fronting VPS IP.

---

## 0.8 — Provision project directory on VPS

```bash
# SSH in
ssh user@your-vps

# Confirm Docker + Compose v2
docker --version
docker compose version    # must be v2.x, not v1 legacy

# Confirm existing services (know your neighbors)
docker ps
docker network ls

# Create project dir
sudo mkdir -p /opt/climate-gb
sudo chown "$USER":"$USER" /opt/climate-gb
cd /opt/climate-gb

# Clone repo (once GitHub remote exists; skip until then)
# git clone git@github.com:<user>/climate-awareness-gb.git .

# For now: transfer files from local machine
# From LOCAL laptop:
#   rsync -avz --exclude 'node_modules' --exclude '.next' \
#     "/Users/jawadhaider/Climate Awareness/" user@vps:/opt/climate-gb/
```

**Sanity check:** `ls /opt/climate-gb` should show `docker-compose.yml`, `plan.md`, `README.md`, etc.

---

## 0.9 — Configure `.env` and bring up Postgres + Redis

```bash
cd /opt/climate-gb

# Copy template
cp .env.example .env

# Generate strong secrets
POSTGRES_PW=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
NEXTAUTH_SEC=$(openssl rand -base64 32)

# Fill in .env (edit by hand or sed)
sed -i "s|POSTGRES_PASSWORD=changeme|POSTGRES_PASSWORD=${POSTGRES_PW}|" .env
sed -i "s|NEXTAUTH_SECRET=changeme|NEXTAUTH_SECRET=${NEXTAUTH_SEC}|" .env

# NEXTAUTH_URL will be your final domain (Phase 0.11). For now leave default.

# Lock down
chmod 600 .env

# Bring up infra containers only (web/worker aren't built yet — Phase 1.A)
docker compose up -d postgres redis

# Verify
docker compose ps
docker compose logs postgres | tail -30
docker compose logs redis | tail -10

# Confirm PostGIS ready
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT PostGIS_Version();"

# Should print something like: 3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1
```

**Sanity check:**

- `docker compose ps` shows both containers healthy.
- `PostGIS_Version()` returns a version.
- Neither container is exposed to public (ports bound to `127.0.0.1`).

**Rollback if broken:** `docker compose down -v` (destroys volumes — only use during initial setup, never after real data).

---

## 0.10 — DNS + Nginx Proxy Manager

**Cloudflare:**

1. Add A record: `climate-gb.<yourdomain>` → VPS public IP.
2. Proxy status: **Proxied** (orange cloud).
3. SSL/TLS mode: **Full (strict)** since NPM will present a valid Let's Encrypt cert.

**Nginx Proxy Manager UI:**

1. Proxy Hosts → Add Proxy Host.
   - Domain Names: `climate-gb.<yourdomain>`
   - Scheme: `http`
   - Forward Hostname / IP: `climate_web` (container name, resolves inside NPM's Docker network — see note below)
   - Forward Port: `3000`
   - Cache Assets: on
   - Block Common Exploits: on
   - Websockets Support: on
2. SSL tab:
   - SSL Certificate: request new Let's Encrypt cert
   - Force SSL: on
   - HTTP/2 Support: on
   - HSTS Enabled: on
3. Advanced tab (optional): add nginx snippet:
   ```nginx
   # Cloudflare real IP
   set_real_ip_from 173.245.48.0/20;
   set_real_ip_from 103.21.244.0/22;
   # ... (full list from https://www.cloudflare.com/ips-v4)
   real_ip_header CF-Connecting-IP;

   # Bypass cache for admin + api
   location ~ ^/(admin|api)/ {
     add_header Cache-Control "no-store";
   }
   ```

**Network note:** NPM must share a Docker network with `climate_web`. Two options:

- **Option A (recommended):** Attach NPM to `climate_net`:

  ```bash
  docker network connect climate_net <npm-container-name>
  ```

  Then in NPM use `climate_web:3000` as the forward host.

- **Option B:** Bind `web` to VPS host `127.0.0.1:3000` (already done in compose), then in NPM use `127.0.0.1:3000` as forward host. Works if NPM runs on host network.

Pick whichever matches your existing NPM setup.

**Cloudflare page rules (recommended):**

- `climate-gb.<yourdomain>/api/*` → Cache Level: Bypass
- `climate-gb.<yourdomain>/admin/*` → Cache Level: Bypass, Security Level: High
- Everything else → default Cloudflare caching

---

## 0.11 — Domain choice

Options ranked by cost / signal:

| Option                                | Cost                                         | Notes                                   |
| ------------------------------------- | -------------------------------------------- | --------------------------------------- |
| `climate-gb.<yourdomain>` (subdomain) | $0                                           | Fastest. Uses domain you already own.   |
| `climate-gb.org`                      | ~$12/yr                                      | Signals non-profit purpose.             |
| `gbclimate.org`                       | ~$12/yr                                      | Shorter.                                |
| `.pk` domain                          | Restricted, ~$40/yr, requires local presence | Signals authenticity; slower to obtain. |

**Recommendation:** start with a subdomain on a domain you already own. Move to a dedicated domain after v1 traction proves the project has legs.

Once chosen, update `.env` on VPS:

```bash
sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://climate-gb.<yourdomain>|" .env
```

---

## 0.12 — Nightly Postgres backup → offsite

**Choose destination first** — Backblaze B2 (10 GB free) or Cloudflare R2 (10 GB free). B2 has simpler CLI; R2 is S3-compatible.

### Backup script

`bin/pg-backup.sh` (also part of the repo, executable):

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/climate-gb/db/backups"
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
DUMP="${BACKUP_DIR}/climate_gb_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump inside the running container, gzip on the way out
docker compose -f /opt/climate-gb/docker-compose.yml exec -T postgres \
  pg_dump -U climate_gb -d climate_gb --format=plain --no-owner \
  | gzip > "$DUMP"

# Upload to Backblaze B2 (requires `rclone` configured with remote named `b2`)
rclone copy "$DUMP" b2:climate-gb-backups/ --progress

# Prune local dumps older than 7 days
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +7 -delete

# Prune remote dumps older than 90 days (adjust to your retention policy)
rclone delete b2:climate-gb-backups/ --min-age 90d
```

### Install

```bash
# One-time rclone setup (interactive)
sudo apt-get install -y rclone
rclone config    # add remote named 'b2', type 'b2', paste key id + app key

# Make script executable
chmod +x /opt/climate-gb/bin/pg-backup.sh

# Test manually
/opt/climate-gb/bin/pg-backup.sh
ls -lh /opt/climate-gb/db/backups/
rclone ls b2:climate-gb-backups/

# Add cron: every day at 03:15 UTC
( crontab -l 2>/dev/null; echo "15 3 * * * /opt/climate-gb/bin/pg-backup.sh >> /var/log/climate-backup.log 2>&1" ) | crontab -

# Verify
crontab -l
```

### Restore drill (run once to confirm backups are real)

```bash
# Download latest
rclone copy b2:climate-gb-backups/climate_gb_<STAMP>.sql.gz /tmp/

# Restore into a scratch DB
docker compose exec postgres createdb -U climate_gb climate_gb_restore_test
gunzip -c /tmp/climate_gb_<STAMP>.sql.gz | \
  docker compose exec -T postgres psql -U climate_gb -d climate_gb_restore_test

# Verify tables exist
docker compose exec postgres psql -U climate_gb -d climate_gb_restore_test -c "\dt"

# Cleanup
docker compose exec postgres dropdb -U climate_gb climate_gb_restore_test
```

**Do this restore drill at least once per quarter.** Untested backups are not backups.

---

## Post-provisioning checklist

- [ ] `.env` on VPS has strong `POSTGRES_PASSWORD` + `NEXTAUTH_SECRET`, mode 600.
- [ ] `docker compose ps` shows `postgres` + `redis` healthy.
- [ ] `PostGIS_Version()` returns a value.
- [ ] Cloudflare A record proxied, DNS resolves to VPS IP.
- [ ] NPM proxy host serves `https://climate-gb.<domain>` (may show 502 until Phase 1.A deploys `web`).
- [ ] `bin/pg-backup.sh` ran successfully, dump visible in B2/R2.
- [ ] Cron installed, `crontab -l` shows entry.
- [ ] Restore drill completed once.

When all boxes ticked, mark Phase 0 tasks 0.8 – 0.12 ✅ in `plan.md` and start Phase 1.A.

---

## Code deployments (ongoing — run on every push to main)

```bash
cd /opt/climate-gb

# 1. Pull latest code
git pull origin main

# 2. Run pending DB migrations
#    The 'tools' service (profile 'tools') runs migrate.ts against the live DB and exits.
docker compose --profile tools run --rm tools pnpm db:migrate

# 3. Rebuild and restart app containers (zero-downtime via Docker restart policy)
docker compose up -d --build web worker

# 4. Verify
docker compose ps
docker compose logs web   --tail 30
docker compose logs worker --tail 30
```

**Migration notes:**

- `docker compose run --rm cli` runs `drizzle-kit migrate` against `DATABASE_URL`.
  Never apply `.sql` files by hand — let Drizzle track migration state.
- If the `cli` service exits non-zero, fix the migration before restarting `web`/`worker`.
- New indexes (e.g. `0003_steady_black_queen.sql`) are non-destructive — safe to apply
  on a live DB. Postgres adds them without locking reads.

---

## Environment variables — deployment notes

| Variable             | Source                                                 | Notes                                                                                               |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`  | `.env`                                                 | Generated at provision time                                                                         |
| `NEXTAUTH_SECRET`    | `.env`                                                 | Used by NextAuth for JWT signing                                                                    |
| `AUTH_SECRET`        | derived in `docker-compose.yml` from `NEXTAUTH_SECRET` | NextAuth v5 reads `AUTH_SECRET`, not `NEXTAUTH_SECRET`; compose maps it — **do not set separately** |
| `OPENROUTER_API_KEY` | `.env`                                                 | Required for RAG agent                                                                              |
| `JINA_API_KEY`       | `.env`                                                 | Required for embedding worker                                                                       |
| `BLOCKED_IPS`        | `.env` (optional)                                      | Comma-separated IPs to permanently block at middleware                                              |

---

## Nginx Proxy Manager — real-IP header (required for IP blocking)

The middleware reads `x-forwarded-for` to enforce `BLOCKED_IPS` and rate limiting.
Without forwarding the real client IP, all requests appear to come from Cloudflare's
edge IPs — the block list is effectively disabled.

**This nginx snippet is required, not optional.** Add it to the NPM Advanced tab for
the proxy host:

```nginx
# Restore real client IP from Cloudflare
# Full list: https://www.cloudflare.com/ips-v4 (update when Cloudflare publishes new ranges)
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;

# Bypass cache for admin + api routes
location ~ ^/(admin|api)/ {
  add_header Cache-Control "no-store";
}
```

Without this, `BLOCKED_IPS` in `.env` blocks Cloudflare's own IPs and breaks the site
for all visitors.
