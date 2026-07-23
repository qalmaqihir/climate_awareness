# Deployment Guide — Climate Awareness GB

Full first-deploy and update workflow. Run commands exactly as written — each step is verified as we do it together.

**Infra prerequisites** (Postgres, Redis, NPM, Cloudflare DNS) are covered in `docs/deploy-runbook.md`. This document picks up after those are done.

---

## Architecture recap

```
[Cloudflare] → [NPM — proxy network] → climate_web:3000
                                              ↓ (climate_net)
                                    climate_postgres  climate_redis
```

`climate_web` is on **both** `proxy` (shared with NPM) and `climate_net` (internal DB/Redis). All other services — postgres, redis, worker — are on `climate_net` only and not reachable from NPM.

Docker Compose profiles:

- _(no profile)_ — postgres + redis only
- `--profile app` — adds web + worker
- `--profile tools` — one-off CLI container (cli stage: pnpm + tsx, no Next.js build)

---

## Step 0 — Generate migrations (LOCAL, once per schema change)

Drizzle does not auto-migrate. SQL files must be generated locally, committed, and then applied on VPS.

```bash
# On your local machine
cd "/Users/jawadhaider/Climate Awareness/web"
pnpm db:generate
```

`pnpm db:generate` automatically runs `scripts/fix-migrations.ts` via the `postdb:generate` hook. This patches a drizzle-kit bug where it wraps PostGIS types in double-quotes (`"geography(Point, 4326)"`) causing a Postgres error `type "geography(Point, 4326)" does not exist`. The hook strips those quotes. **Commit the patched SQL as-is.**

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

> **Do this every time you change `web/src/lib/schema.ts`.** Never edit the generated SQL by hand — run `db:generate` instead so the auto-fix hook also runs.

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

| Variable            | Required value                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| `POSTGRES_PASSWORD` | **Hex only** — `openssl rand -hex 16`. NO base64 (slashes break the URL)       |
| `NEXTAUTH_URL`      | Exactly `https://climate-gb.qalmaq.cloud` (your NPM domain, with https)        |
| `NEXTAUTH_SECRET`   | Min 32 random bytes — `openssl rand -base64 32` (base64 OK here, not in a URL) |
| `ADMIN_EMAILS`      | Comma-separated emails that can sign in as admin                               |

> **POSTGRES_PASSWORD must be URL-safe.** The password is embedded in `DATABASE_URL` by docker-compose.
> Characters like `/` and `=` (present in base64 output) break URL parsing and cause a silent
> `TypeError: Invalid URL` in both `db:migrate` and `db:seed`. Use hex: `openssl rand -hex 16`.
>
> If postgres was already initialized with a bad password:
>
> ```bash
> # Destroy volume and reinit (only safe while no real data exists)
> docker compose down -v
>
> # Generate URL-safe values
> POSTGRES_PASSWORD=$(openssl rand -hex 16)
> NEXTAUTH_SECRET=$(openssl rand -base64 32)
>
> # Update .env
> sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
> sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|" .env
> sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://climate-gb.qalmaq.cloud|" .env
>
> # Also update DATABASE_URL to use 127.0.0.1 (only needed for local dev outside Docker)
> sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgres://climate_gb:${POSTGRES_PASSWORD}@127.0.0.1:5432/climate_gb|" .env
>
> chmod 600 .env
>
> # Reinit postgres with new password
> docker compose up -d postgres redis
> ```
>
> Then continue from Step 2.

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

Migrations run inside the `tools` container (cli stage: pnpm + tsx, no Next.js build).

> **Important**: If you changed any file under `web/scripts/` since the last deploy, rebuild the tools image first — `docker compose run` uses a cached image by default:
>
> ```bash
> docker compose --profile tools build tools
> ```

```bash
docker compose --profile tools run --rm tools pnpm db:migrate
```

Expected output:

```
Applying migrations from ./drizzle …
Migrations complete.
```

`db:migrate` uses `scripts/migrate.ts` (programmatic drizzle-orm migrator). It prints real errors. The old `drizzle-kit migrate` CLI had silent exit-code-1 failures — do not use it.

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

Replace email and password with real values. Password is bcrypt-hashed — not stored in plain text.

**Security**: use a different password than `POSTGRES_PASSWORD`. They serve different systems.

Verify the email is in `ADMIN_EMAILS` in `.env`. If not, add it:

```bash
grep ADMIN_EMAILS .env
# Should include info@qalmaq.cloud
```

If `admin:create` fails with `SyntaxError: Cannot use 'import.meta' outside a module` or `top-level await is not allowed`, rebuild the tools image — the cached image is stale:

```bash
docker compose --profile tools build tools
docker compose --profile tools run --rm tools \
  pnpm admin:create info@qalmaq.cloud 'YourStrongPassword'
```

---

## Step 8 — VPS: configure NPM proxy

`climate_web` is already declared on the external `proxy` network in `docker-compose.yml` — no manual `docker network connect` needed. After `docker compose --profile app up -d --build`, the container joins `proxy` automatically.

Verify `climate_web` is on `proxy`:

```bash
docker network inspect proxy | grep climate_web
# Should show the container entry
```

In NPM UI, create a proxy host:

- **Domain**: `climate-gb.qalmaq.cloud`
- **Forward Hostname**: `climate_web`
- **Forward Port**: `3000`
- Enable **SSL** (Let's Encrypt or existing cert)

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

- [ ] `web/drizzle/*.sql` files committed and on VPS (run `pnpm db:generate` locally, geography quoting auto-fixed)
- [ ] `.env` has `POSTGRES_PASSWORD` as hex only (`openssl rand -hex 16`), `NEXTAUTH_URL` exactly `https://climate-gb.qalmaq.cloud`, strong `NEXTAUTH_SECRET`
- [ ] `docker compose ps` → all four containers up, postgres healthy
- [ ] `docker compose --profile tools build tools` run after any script change
- [ ] `db:migrate` output: "Migrations complete." (not silent exit)
- [ ] `\dt` in postgres shows schema tables including `events`, `sources`, `user`
- [ ] Seed ran: 7 sources visible at `/api/sources`
- [ ] Admin user created (`admin:create`) and can sign in at `/admin`
- [ ] `docker network inspect proxy | grep climate_web` shows the container
- [ ] NPM proxy host: `climate_web:3000` with SSL
- [ ] `https://climate-gb.qalmaq.cloud` serves HTTP 200

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

---

## Troubleshooting — errors hit during first deploy

All of these errors were encountered and fixed. If they appear again, here is the exact cause and fix.

### `type "geography(Point, 4326)" does not exist`

**Cause**: drizzle-kit wraps custom type names in double-quotes in generated SQL. Postgres treats `"geography(Point, 4326)"` as a quoted identifier, not a type call.

**Fix**: Already automated — `pnpm db:generate` runs `scripts/fix-migrations.ts` via `postdb:generate` hook, which strips those quotes. If this appears on VPS it means you ran `pnpm db:generate` without committing, or the hook didn't run. Re-run `pnpm db:generate` locally and push.

---

### `TypeError: Invalid URL` during migrate or seed

**Cause**: `POSTGRES_PASSWORD` contains `/` or `=` (base64 output). These break URL parsing when the password is embedded in `DATABASE_URL` by docker-compose.

**Fix**: Regenerate password as hex:

```bash
docker compose down -v   # destroys volume — only safe with no real data
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|" .env
docker compose up -d postgres redis
```

---

### `relation "sources" does not exist` during seed

**Cause**: Migrations didn't apply. Either `db:migrate` silently failed (old drizzle-kit CLI), or the tools image was cached before the migrate script was fixed.

**Fix**:

```bash
docker compose --profile tools build tools   # force fresh image
docker compose --profile tools run --rm tools pnpm db:migrate
# Must print "Migrations complete." — if it doesn't, the error above it is the real cause
docker compose --profile tools run --rm tools pnpm db:seed
```

---

### `db:migrate` exits silently with no output (or exit code 1)

**Cause**: Old cached tools image still running `drizzle-kit migrate` CLI, which swallows errors.

**Fix**: Rebuild tools image — `db:migrate` now uses `scripts/migrate.ts` (programmatic migrator with real error output):

```bash
docker compose --profile tools build --no-cache tools
```

---

### `/app/public: not found` during Docker build

**Cause**: `web/public/` directory didn't exist. The `COPY --from=builder /app/public` step in the runner stage fails if there is nothing to copy.

**Fix**: Already in `web/Dockerfile` — the builder stage runs `mkdir -p public && pnpm build`. No action needed unless you manually delete that line.

---

### `top-level await is not allowed in CommonJS` in tools container

**Cause**: `tsx` runs scripts in CJS mode. Top-level `await` outside an `async` function is a syntax error.

**Fix**: Already patched in `scripts/create-admin.ts` and `scripts/migrate.ts` — both wrap logic in `async function main() { ... } main().catch(...)`. If another script shows this error, apply the same pattern.

---

### `ssr: false` build error in `app/` directory (Turbopack/Next.js 16)

**Cause**: `dynamic({ ssr: false })` is only allowed in Client Components. Server Components (files without `'use client'`) cannot use it.

**Fix**: Already applied — `app/map/page.tsx` is now a thin Server Component that renders `MapPageClient.tsx` (`'use client'`), which does the `dynamic` import. Apply same pattern to any future page using `ssr: false`.

---

### `Failed to load external module node:util/types` / Internal Server Error on all pages

**Cause**: Next.js middleware always runs in Edge Runtime (V8 isolate). If `middleware.ts` imports `auth` from `auth.ts`, that pulls in `pg` → `node:util/types` → crash. Every request hits middleware, so every page returns 500.

**Fix**: Already applied — `auth.config.ts` holds an edge-safe config (no pg, no adapter, no bcrypt). `middleware.ts` creates its own `NextAuth(authConfig)` instance. Full `auth.ts` (with DrizzleAdapter + pg) only runs in Server Components and API routes (Node.js runtime).

If this error reappears after adding new imports to `middleware.ts`, check that none of them transitively import `pg`, `drizzle-orm/node-postgres`, `bcryptjs`, or any `node:*` module.

---

### tools container uses stale cached image after script changes

**Cause**: `docker compose run --rm tools` does not rebuild the image. Edits to `web/scripts/` are not picked up until you explicitly rebuild.

**Fix** (run this any time you change a script and need to run it via tools):

```bash
docker compose --profile tools build tools
```
