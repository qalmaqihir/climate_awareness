# Deployment Guide — Climate Awareness GB

Full first-deploy and update workflow. Run commands exactly as written — each step is verified as we do it together.

**Infra prerequisites** (Postgres, Redis, NPM, Cloudflare DNS) are covered in `docs/deploy-runbook.md`. This document picks up after those are done.

---

## Architecture recap

```
[Cloudflare] → [NPM on VPS] → climate_web:3000
                                    ↓
                              climate_postgres  climate_redis
```

Docker Compose profiles:

- _(no profile)_ — postgres + redis only
- `--profile app` — adds web + worker
- `--profile tools` — one-off CLI container for migrations/seed/admin (exits after command)

---

## Step 0 — Generate migrations (LOCAL, once per schema change)

Drizzle does not auto-migrate. SQL files must be generated locally, committed, and then applied on VPS.

```bash
# On your local machine
cd "/Users/jawadhaider/Climate Awareness/web"
pnpm db:generate
```

Inspect what was generated:

```bash
ls drizzle/
```

Commit and push:

```bash
cd ..
git add web/drizzle/
git commit -m "feat(db): generate initial schema migrations"
git push
```

> **Do this every time you change `web/src/lib/schema.ts`.** Never edit the generated SQL by hand.

---

## Step 1 — VPS: pull latest code

```bash
ssh qalmaq@srv1322288

cd ~/docker/apps/climate_awareness/climate_awareness

git pull
```

Verify migration files arrived:

```bash
ls web/drizzle/
# Should show *.sql files
```

---

## Step 2 — VPS: verify infra is healthy

```bash
docker compose ps
# postgres → healthy, redis → healthy

docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT PostGIS_Version();"
# Must return a version string, e.g. "3.4 USE_GEOS=1 ..."
```

If postgres/redis are down:

```bash
docker compose up -d postgres redis
# Wait ~15 s then recheck
```

---

## Step 3 — VPS: verify .env values

```bash
cat .env
```

Check these are correct before proceeding:

| Variable            | Required value                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | Must match what postgres was initialized with                           |
| `NEXTAUTH_URL`      | Exactly `https://climate-gb.qalmaq.cloud` (your NPM domain, with https) |
| `NEXTAUTH_SECRET`   | Min 32 random bytes — generate: `openssl rand -base64 32`               |
| `ADMIN_EMAILS`      | Comma-separated emails that can sign in as admin                        |

> **NEXTAUTH_SECRET too short?** The `.env` on VPS currently has a short value. Regenerate:
>
> ```bash
> NEXTAUTH_SECRET=$(openssl rand -base64 32)
> sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" .env
> ```
>
> Restart web after changing this.

---

## Step 4 — VPS: build and start the app

```bash
docker compose --profile app up -d --build
```

This builds `climate_web` and `climate_worker` images, then starts all four containers.

Watch logs:

```bash
docker compose logs -f web
# Look for: "▲ Next.js 16.x.x" and "started server on 0.0.0.0:3000"
```

Check all containers healthy:

```bash
docker compose ps
```

Expected:

```
NAME                STATUS
climate_postgres    Up X minutes (healthy)
climate_redis       Up X minutes (healthy)
climate_web         Up X minutes (healthy)
climate_worker      Up X minutes
```

---

## Step 5 — VPS: run database migrations

Migrations run inside the `tools` container (builder stage has pnpm + drizzle-kit):

```bash
docker compose --profile tools run --rm tools pnpm db:migrate
```

Expected output: Drizzle applies each pending `.sql` file and prints confirmation.

Verify tables exist:

```bash
docker compose exec postgres psql -U climate_gb -d climate_gb -c "\dt"
# Should list: users, accounts, sessions, events, sources, ...
```

---

## Step 6 — VPS: seed initial data (optional)

Loads default data sources (PDMA, NDMA, etc.):

```bash
docker compose --profile tools run --rm tools pnpm db:seed
```

---

## Step 7 — VPS: create admin user

```bash
docker compose --profile tools run --rm tools \
  pnpm admin:create info@qalmaq.cloud 'YourStrongPassword'
```

Replace email and password. Password is hashed with bcrypt — it is not stored in plain text.

Verify the email is in `ADMIN_EMAILS` in `.env`. If not, add it:

```bash
grep ADMIN_EMAILS .env
# Should include info@qalmaq.cloud
```

---

## Step 8 — VPS: connect NPM to climate_net

NPM must share a Docker network with `climate_web` to route traffic to it.

```bash
# Find NPM container name
docker ps | grep nginx-proxy

# Connect it to climate_net (idempotent)
docker network connect climate_net <npm-container-name>
```

Verify:

```bash
docker network inspect climate_net | grep -A2 '"Name"'
# Should list: climate_postgres, climate_redis, climate_web, climate_worker, <npm-container>
```

In NPM UI:

- Forward Hostname: `climate_web`
- Forward Port: `3000`

---

## Step 9 — Verify end-to-end

```bash
# From VPS
curl -I https://climate-gb.qalmaq.cloud/
# HTTP/2 200

# Check admin panel (should redirect to login if not authenticated)
curl -I https://climate-gb.qalmaq.cloud/admin
# HTTP/2 200 or 302
```

Open in browser: `https://climate-gb.qalmaq.cloud`

Sign in at `/admin` with the email + password from Step 7.

---

## First-deploy checklist

- [ ] `web/drizzle/*.sql` files committed and on VPS
- [ ] `.env` has correct `NEXTAUTH_URL`, strong `NEXTAUTH_SECRET`, `POSTGRES_PASSWORD` matches DB init
- [ ] `docker compose ps` → all four containers up, postgres healthy
- [ ] `\dt` in postgres shows schema tables
- [ ] Admin user created and can sign in at `/admin`
- [ ] `https://climate-gb.qalmaq.cloud` serves 200
- [ ] NPM container joined `climate_net`

---

## Updating (subsequent deploys)

```bash
ssh qalmaq@srv1322288
cd ~/docker/apps/climate_awareness/climate_awareness

git pull

# If schema changed — apply new migrations
docker compose --profile tools run --rm tools pnpm db:migrate

# Rebuild + restart app containers only (zero-downtime for infra)
docker compose --profile app up -d --build web worker

# Verify
docker compose ps
docker compose logs -f web
```

> Postgres and Redis do **not** need to restart on code changes.

---

## Rollback

```bash
# Roll back to previous image (if you tagged before deploy — see below)
docker compose stop web worker
docker tag climate_awareness-web:previous climate_awareness-web:latest
docker compose --profile app up -d web worker
```

**Tag before each deploy** (add to your deploy habit):

```bash
docker tag climate_awareness-web:latest climate_awareness-web:previous
```

---

## Logs and debugging

```bash
# Live web logs
docker compose logs -f web

# Live worker logs
docker compose logs -f worker

# Postgres query log (last 50 lines)
docker compose logs --tail=50 postgres

# Shell into running web container (no pnpm — standalone only)
docker compose exec web sh

# Shell into tools container (full pnpm + tsx access)
docker compose --profile tools run --rm tools sh
```

---

## Backup

Covered in `docs/deploy-runbook.md` § 0.12. Ensure `bin/pg-backup.sh` cron is active:

```bash
crontab -l | grep backup
```
