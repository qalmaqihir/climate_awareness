# Northern Pakistan Climate Watch — Implementation Plan

_(formerly "Climate Awareness GB" — scope expanded to GB + Chitral on 2026-07-23)_

**Companion to:** `idea.md`
**Last updated:** 2026-07-23
**Current phase:** Phase 2.A (VPS fixes pending) → 2.B (Telegram bot) → 2.E (Chitral data expansion) next
**Resume rule:** Always read this file top-to-bottom before resuming work. Update the **Status** column of every task as you go.

---

## Status legend

- ⬜ Not started
- 🟨 In progress
- ✅ Done
- ⏭️ Skipped (with reason inline)
- 🚧 Blocked (with blocker inline)

## Global conventions

- **Branching:** `main` = deployable. Feature branches: `phase-N/short-name`.
- **Commits:** Conventional Commits. `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- **Every phase ends with:** all tasks ✅, tests/manual check pass, commit, tag, deploy.
- **Never skip verification.** Update this file before moving to next phase.

---

# PHASE 0 — Foundations (before code)

**Goal:** Confirm feasibility, lock scope, prep dev environment.
**Duration target:** 1–2 evenings.
**Exit criteria:** Feasibility findings saved, repo initialized, Supabase + Vercel accounts ready.

| #    | Task                                                                                                                                                                       | Status | Notes                                                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | Web-search current GB flood situation (2026 monsoon), latest events, active orgs                                                                                           | ✅     | Saved to `research/gb-situation.md`                                                                                                                                  |
| 0.2  | Verify data endpoints: PDMA GB feed URL, NDMA API, ICIMOD RDS, Open-Meteo                                                                                                  | ✅     | Saved to `research/data-sources.md`                                                                                                                                  |
| 0.3  | Verify Meta oEmbed access requirements (app registration, token flow)                                                                                                      | ✅     | **Tokenless since Jun 15 2026**. Covered in `research/data-sources.md`. No separate file needed.                                                                     |
| 0.4  | Save project memory (`~/.claude/projects/-Users-jawadhaider-Climate-Awareness/memory/`)                                                                                    | ✅     | 4 files + MEMORY.md index                                                                                                                                            |
| 0.5  | Init git repo (`git init` done by user) + first commit with `README.md`, `idea.md`, `plan.md`, `research/`, `docker-compose.yml`, `.env.example`, `.gitignore`, `db/init/` | ✅     | First commit `79a2c82` on `main`: 9 files, +1078 lines                                                                                                               |
| 0.6  | Create GitHub repo (private initially), push                                                                                                                               | ⏭️     | Deferred by user. Local-only for now. Push before VPS deploy in Phase 1.G.                                                                                           |
| 0.7  | Draft root `docker-compose.yml` skeleton: `postgres`, `redis`, `web` (Next.js), `worker` (cron)                                                                            | ✅     | YAML validated with `docker compose config`. Uses `postgis/postgis:16-3.4`, Redis 7, internal `climate_net`, ports bound to `127.0.0.1`. See §Infra reference below. |
| 0.8  | Provision on VPS: create project dir `/opt/climate-gb/`, rsync or clone repo, add `.env` (not committed)                                                                   | 🟨     | Runbook: [`docs/deploy-runbook.md §0.8`](docs/deploy-runbook.md). User to execute.                                                                                   |
| 0.9  | Bring up `postgres` + `redis` on VPS, verify PostGIS enabled, verify healthchecks                                                                                          | 🟨     | Runbook: [`docs/deploy-runbook.md §0.9`](docs/deploy-runbook.md).                                                                                                    |
| 0.10 | Create Cloudflare DNS record → VPS IP; add proxy host in NPM (HTTP → app container:3000, force SSL via Let's Encrypt)                                                      | 🟨     | Runbook: [`docs/deploy-runbook.md §0.10`](docs/deploy-runbook.md) — includes NPM network attach + Cloudflare rules.                                                  |
| 0.11 | Pick + buy domain or use existing subdomain                                                                                                                                | 🟨     | Runbook: [`docs/deploy-runbook.md §0.11`](docs/deploy-runbook.md). Recommendation: start with subdomain of a domain you already own.                                 |
| 0.12 | Configure nightly `pg_dump` cron on VPS → encrypted upload (Backblaze B2 or Cloudflare R2 free tier)                                                                       | 🟨     | Script written: [`bin/pg-backup.sh`](bin/pg-backup.sh). Runbook: [`docs/deploy-runbook.md §0.12`](docs/deploy-runbook.md) — includes restore drill.                  |

**Deploy checkpoint:** Postgres + Redis containers running on VPS, reachable only via internal Docker network. Not exposed to public.
**Commit message:** `chore: initialize project with plan, research, and docker-compose skeleton`

### Infra reference — `docker-compose.yml` v0 skeleton

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    restart: unless-stopped
    environment:
      POSTGRES_DB: climate_gb
      POSTGRES_USER: climate_gb
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks: [climate_net]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U climate_gb -d climate_gb']
      interval: 10s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ['redis-server', '--maxmemory', '256mb', '--maxmemory-policy', 'allkeys-lru']
    volumes:
      - redis_data:/data
    networks: [climate_net]

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    environment:
      DATABASE_URL: postgres://climate_gb:${POSTGRES_PASSWORD}@postgres:5432/climate_gb
      REDIS_URL: redis://redis:6379
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NODE_ENV: production
    ports: ['127.0.0.1:3000:3000'] # NPM proxies to this
    networks: [climate_net]

  worker:
    build:
      context: ./worker
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://climate_gb:${POSTGRES_PASSWORD}@postgres:5432/climate_gb
    networks: [climate_net]

volumes:
  pg_data:
  redis_data:

networks:
  climate_net:
    driver: bridge
```

`.env` (not committed, live on VPS only):

```
POSTGRES_PASSWORD=<strong random>
NEXTAUTH_URL=https://climate-gb.example.org
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

---

# PHASE 1 — v1 MVP: Map + Feed + Alerts

**Goal:** Public-facing site with GB map, verified event pins, official alerts, weather overlay.
**Duration target:** 4 weeks × ~10 hrs/wk.
**Audience:** International orgs, media, diaspora.
**Exit criteria:** Site live on Vercel, 10 seed events pinned, PDMA feed refreshing, share buttons working.

## 1.A — Scaffold + base layout + Dockerfile (Week 1)

| #      | Task                                                                                                                                                                             | Status | Notes                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| 1.A.1  | `pnpm create next-app@latest web` with TypeScript, App Router, Tailwind, ESLint, src-dir, turbopack                                                                              | ✅     | Next 16.2.11, React 19.2.4, TS 5.9, Tailwind 4. Package manager: pnpm 11.15.1 via corepack. |
| 1.A.2  | Install: `pg`, `drizzle-orm`, `next-auth@beta`, `@auth/drizzle-adapter`, `maplibre-gl`, `react-map-gl`, `zod`, `date-fns`, `ioredis`, `bcryptjs`, `drizzle-kit`, `@types/pg`     | ✅     | ORM: Drizzle. `pnpm-workspace.yaml` grants `allowBuilds` for esbuild+sharp+unrs-resolver.   |
| 1.A.3  | Env setup: `web/.env.example` committed with `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Real values in `.env.local` (dev) and root `.env` (prod, VPS-only). | ✅     |                                                                                             |
| 1.A.4  | Configure `next.config.ts` with `output: "standalone"` + `poweredByHeader: false` + AVIF/WebP                                                                                    | ✅     |                                                                                             |
| 1.A.5  | Write `web/Dockerfile` (multi-stage deps → build → runner, node:20-alpine, non-root user, HEALTHCHECK) + `.dockerignore`                                                         | ✅     |                                                                                             |
| 1.A.6  | Base layout: header (logo + nav Map/Alerts/About), footer (attribution + source list)                                                                                            | ✅     | Tailwind. Inter font. Mobile-first.                                                         |
| 1.A.7  | Placeholder pages: `/`, `/map`, `/alerts`, `/about`                                                                                                                              | ✅     | Server components; each has real copy + phased status text                                  |
| 1.A.8  | Global styles + typography (Inter font, slate palette, teal-700 accent)                                                                                                          | ✅     | `globals.css` uses `@theme inline` with `--color-accent`                                    |
| 1.A.9  | 404 (`not-found.tsx`) + error boundary (`error.tsx`, client component)                                                                                                           | ✅     |                                                                                             |
| 1.A.10 | Local verification: `pnpm typecheck` + `pnpm lint` + `pnpm build` all pass; docker build validates                                                                               | 🟨     | Build verified static prerender for 5 routes. Docker build running in background — see log. |

**Verification result:** Next build succeeded, 5 static routes (`/`, `/_not-found`, `/about`, `/alerts`, `/map`). Typecheck + lint clean. Docker build in background.
**Commit:** `feat(web): scaffold Next.js app, Dockerfile, base layout, routing`

## 1.B — Postgres/PostGIS schema + migrations (Week 1)

| #      | Task                                                                                                               | Status | Notes                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| 1.B.1  | Enable extensions on first boot: `postgis`, `pgcrypto` (for `gen_random_uuid`)                                     | ✅     | `db/init/00-extensions.sql`                                                      |
| 1.B.2  | Choose migration tool: Drizzle Kit (recommended) or Prisma Migrate                                                 | ✅     | Drizzle Kit. `web/drizzle.config.ts` written.                                    |
| 1.B.3  | Define `sources` schema                                                                                            | ✅     | `web/src/lib/schema.ts` — `sources` table                                        |
| 1.B.4  | Define `events` schema with `geography(Point)` column                                                              | ✅     | `customType` geography(Point,4326) via PostGIS                                   |
| 1.B.5  | Define `alerts` schema                                                                                             | ✅     | `alerts` table with level + district + expiry                                    |
| 1.B.6  | Define `weather_snapshots` schema                                                                                  | ✅     | `weather_snapshots` table, keyed by district + fetchedAt                         |
| 1.B.7  | Define NextAuth tables (`users`, `accounts`, `sessions`, `verification_tokens`) via `@auth/drizzle-adapter` schema | ✅     | All 4 tables in schema.ts; adapter wired in `auth.ts`                            |
| 1.B.8  | Enforce app-layer access control (admin routes only): no RLS needed since only server-side queries                 | ✅     | `ADMIN_EMAILS` allowlist env var; `isAdmin` JWT claim                            |
| 1.B.9  | Seed script for whitelisted sources                                                                                | ✅     | `web/scripts/seed-sources.ts` — 7 sources; `pnpm db:seed`                        |
| 1.B.10 | Server DB client in `web/src/lib/db.ts` (Drizzle instance + typed queries)                                         | ✅     | Pool(10) + drizzle-orm/node-postgres                                             |
| 1.B.11 | Migration workflow: `pnpm db:generate` + `pnpm db:migrate`                                                         | ✅     | Documented in runbook; migrations in `web/drizzle/` (gitignored until first gen) |

### Schema reference

```sql
create extension if not exists postgis;

create type event_type as enum ('glof', 'flash_flood', 'landslide', 'infra_damage', 'other');

create table sources (
  slug text primary key,
  name text not null,
  url text,
  kind text,          -- news|govt|ngo|research
  verified boolean default true,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  event_type event_type not null,
  occurred_at timestamptz not null,
  location geography(Point, 4326) not null,
  district text,
  valley text,
  severity smallint check (severity between 1 and 5),
  summary text not null,
  source_url text not null,
  source_slug text references sources(slug),
  embed_html text,
  verified_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index events_occurred_at_idx on events (occurred_at desc);
create index events_location_gix on events using gist (location);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  source_slug text references sources(slug),
  issued_at timestamptz not null,
  valid_until timestamptz,
  severity smallint,
  region text,
  title text not null,
  body text,
  source_url text,
  created_at timestamptz default now()
);

create table weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  captured_at timestamptz default now(),
  payload jsonb not null
);
```

**Verification:** Insert 1 test event via SQL editor, query it, delete it.
**Commit:** `feat: add Supabase schema with events, alerts, weather, sources`

## 1.C — Map view (Week 2)

| #     | Task                                                                     | Status | Notes                                                                    |
| ----- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| 1.C.1 | `/map` client component with MapLibre + OSM tiles                        | ✅     | OpenFreeMap Positron tiles (no token). SSR-off via `dynamic()`.          |
| 1.C.2 | Server action to fetch events (filter by date + type + district)         | ✅     | `/api/events` GeoJSON route. `getEvents(filters?)` in `queries.ts`.      |
| 1.C.3 | Render pins with clustering (supercluster)                               | ✅     | Native MapLibre cluster on GeoJSON Source. Teal/blue/purple by count.    |
| 1.C.4 | Pin colors by `event_type`, size by `severity`                           | ✅     | `EVENT_TYPE_COLORS` + severity radius expression in `MapView.tsx`.       |
| 1.C.5 | Sidebar filter panel: event type checkboxes, date range, district select | ✅     | Client-side `useMemo` filter on full GeoJSON. Toggle button.             |
| 1.C.6 | Click pin → popup with summary + source link + "View details"            | ✅     | MapLibre Popup. Click cluster → zoom; click pin → popup.                 |
| 1.C.7 | Event detail page `/events/[id]` with oEmbed render + weather-at-time    | ✅     | `app/events/[id]/page.tsx` — type/severity/verified badges, `embedHtml`. |
| 1.C.8 | GB boundary overlay (GeoJSON from OSM or admin dataset)                  | ⏭️     | Deferred. Map pin density already provides spatial context for v1.       |

**Verification:** Manually seed 10 events across GB districts; verify clustering, filters, detail pages.
**Commit:** `feat: interactive map with event pins, filters, detail view`

## 1.D — Admin panel + NextAuth + Meta oEmbed (Week 2–3)

| #     | Task                                                                               | Status | Notes                                                                                      |
| ----- | ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| 1.D.1 | Meta oEmbed integration (tokenless, no app registration)                           | ✅     | `lib/oembed.ts` — detects FB/IG, calls Meta oEmbed v22.0 (tokenless).                      |
| 1.D.2 | NextAuth.js config with Credentials provider + Drizzle adapter                     | ✅     | `lib/auth.ts` + `api/auth/[...nextauth]/route.ts`. NextAuth v5 beta.                       |
| 1.D.3 | Admin allowlist: seed 1-3 admin users with bcrypt-hashed passwords via CLI script  | ✅     | `scripts/create-admin.ts` → `pnpm admin:create <email> <password>`                         |
| 1.D.4 | `/admin` route + middleware: reject if not authenticated + not in admin role       | ✅     | `middleware.ts` + `admin/layout.tsx` double-check. `isAdmin` JWT claim.                    |
| 1.D.5 | New event form: paste URL → server fetches oEmbed → prefill form                   | ✅     | `admin/events/new/page.tsx`. Paste URL → `GET /api/admin/oembed?url=` → prefill.           |
| 1.D.6 | Manual fields: event type, severity, occurred_at, valley, district, lat/lng picker | ✅     | All fields in new/edit form. Lat/lng entered manually (map click deferred to v2).          |
| 1.D.7 | Save event → server action → Drizzle insert                                        | ✅     | `POST /api/admin/events` with Zod validation. `POINT(lng lat)` WKT via PostGIS.            |
| 1.D.8 | Edit + delete existing events                                                      | ✅     | `PATCH /api/admin/events/[id]` (partial update), `DELETE` → soft-delete (status=archived). |
| 1.D.9 | Admin dashboard: event count, pending review queue, recent alerts                  | ✅     | `admin/page.tsx` — 3 stat boxes, events table, alerts sidebar.                             |

**Verification:** Log in, create event via oEmbed, edit it, delete it. All flows work.
**Commit:** `feat: admin panel with Meta oEmbed ingestion`

## 1.E — Alerts + weather + worker cron (Week 3)

| #     | Task                                                                                                | Status | Notes                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| 1.E.1 | Confirm PDMA GB feed source (RSS? scrape?). Document in `research/`                                 | 🟨     | Manual alert entry via admin for now. Scraper deferred to 1.E.3 post-deploy.             |
| 1.E.2 | Build `worker/` service (Node + TypeScript + `node-cron`) in Docker                                 | ✅     | `worker/src/index.ts` with SIGTERM handler. `worker/Dockerfile` (node:22-alpine).        |
| 1.E.3 | Cron job: hourly `refresh-alerts` — Cheerio scrape → upsert into `alerts` (dedupe by `source_url`)  | 🟨     | `check-pdma.ts` stub written. Full scraper after deploy when real feeds confirmed.       |
| 1.E.4 | `/alerts` page: list active alerts, severity badges, region filter                                  | ✅     | Done in Phase 1.F. DB-backed, grouped by level (emergency/warning/watch/advisory).       |
| 1.E.5 | Home page shows top 3 active alerts                                                                 | ✅     | Alert count in home hero — pulse badge if alerts > 0, link to /alerts.                   |
| 1.E.6 | Open-Meteo integration in worker: refresh weather cache for pinned valleys every 6h                 | ✅     | `refresh-weather.ts` — 6 GB districts, Open-Meteo `current`, upsert `weather_snapshots`. |
| 1.E.7 | On new event save: web triggers on-demand weather snapshot fetch (historical Open-Meteo `/archive`) | ⏭️     | Deferred. Historical weather on event detail is v2 scope.                                |
| 1.E.8 | Event detail page shows weather-at-time (nearest snapshot)                                          | ⏭️     | Deferred. v2 scope.                                                                      |
| 1.E.9 | Worker logs to stdout → Docker log driver → optional Loki/Promtail later                            | ✅     | stdout only in v1. `docker compose logs worker` sufficient.                              |

**Verification:** Trigger cron manually, confirm alerts appear, weather renders on event page.
**Commit:** `feat: alerts feed + weather integration via cron`

## 1.F — Home page + share + polish (Week 4)

| #     | Task                                                                          | Status | Notes                                                                                    |
| ----- | ----------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| 1.F.1 | Home hero: map preview, live stats ("N events in 30 days", "N alerts active") | ✅     | Topographic SVG hero, Playfair Display, dark stats strip with `<StatCounter>` animation. |
| 1.F.2 | Recent events feed (3 latest with embed)                                      | ✅     | 3-card grid from DB, linked to `/events/[id]`, type badge + district + date.             |
| 1.F.3 | Share buttons: Twitter/X, Facebook, WhatsApp, copy link                       | ✅     | `<ShareButtons>` client component. Pre-filled tweet includes event count from DB.        |
| 1.F.4 | About page: mission, sources, editorial policy, contact                       | ✅     | 7 sources, 6 editorial principles, v2/v3 roadmap, open data links, `info@naseyou.nl`.    |
| 1.F.5 | Take Action page: how to share, orgs to tag, donation links (AKAH, UNDP)      | ✅     | Pre-filled tweet + WA, 4 org cards (AKAH/UNDP GLOF-II/PMD/ICIMOD), journalist section.   |
| 1.F.6 | SEO: metadata, OpenGraph, sitemap, robots.txt                                 | ✅     | `metadataBase`, OG + Twitter card in layout. `sitemap.ts` + `robots.ts` via App Router.  |
| 1.F.7 | Analytics: Plausible or Vercel Analytics (privacy-friendly)                   | ⏭️     | Deferred. Add `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` script in layout when domain confirmed.     |
| 1.F.8 | Accessibility pass: alt text, keyboard nav, color contrast                    | ⏭️     | Core semantic HTML + `aria-hidden` on decorative SVGs done. Full audit deferred post-v1. |
| 1.F.9 | Open data endpoint: `/api/events.geojson` + `/api/events.csv`                 | ✅     | `/api/events` (GeoJSON) + `/api/events/csv` (13-col CSV). Both CORS + cache headers.     |

**Verification:** Full manual click-through, Lighthouse ≥ 90 on all pages, share links work in prod.
**Commit:** `feat: home page, share, take action, open data, SEO`

## 1.G — Deploy v1 to VPS (End of Week 4)

| #     | Task                                                                                                 | Status | Notes                                          |
| ----- | ---------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| 1.G.1 | On VPS: `cd /opt/climate-gb && git pull && docker compose build web worker && docker compose up -d`  | ✅     | Done. Also applied migrations and seeded data. |
| 1.G.2 | NPM proxy host: subdomain → `web:3000`, force SSL (Let's Encrypt), Cloudflare in front               | ✅     | Done.                                          |
| 1.G.3 | Verify Cloudflare cache rules (bypass on `/admin`, `/api/*`; cache static assets)                    | ✅     | Done.                                          |
| 1.G.4 | Seed 10–20 verified events from Pamir Times + Ibex last 6 months                                     | ✅     | Done via admin.                                |
| 1.G.5 | Smoke test in production: home, map, event detail, alerts, admin login, oEmbed                       | ✅     | Done.                                          |
| 1.G.6 | Confirm nightly `pg_dump` backup ran + upload succeeded                                              | ✅     | Done.                                          |
| 1.G.7 | Tag release `v1.0.0`                                                                                 | ✅     | Done.                                          |
| 1.G.8 | Simple deploy script `bin/deploy.sh` (git pull + compose build + compose up + migrate + healthcheck) | ✅     | Done.                                          |
| 1.G.9 | Announce on personal Twitter/LinkedIn (soft launch)                                                  | ⬜     | User to do.                                    |

**Adversarial code review (post-1.G):** 13 P0+P1 fixes applied and typechecked clean.
P0: open redirect fix (callbackUrl), SSRF/timeout fix (oembed.ts), readOnly embedHtml textarea.
P1: sign-out POST server action, JWT type merge, DATABASE_URL guard, Dockerfile pnpm fix, date validation, row limit, 404 on missing event, lat/lng pair validation, weather_code field fix + cleanup + Promise.all, SIGINT handler.
P2 deferred: weatherSnapshots lat/lng as text (needs migration), DOMPurify for oEmbed HTML, CSP headers, ioredis cleanup, admin pagination.

**Exit v1.** Move to Phase 2 planning check.

---

## 1.H — Post-Deploy Hardening + Alert Scraper

| #     | Task                                                                                                      | Status | Notes                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| 1.H.1 | Security headers in `next.config.ts`: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, CSP | ✅     | CSP allows MapLibre blobs, Meta oEmbed scripts, Google Fonts, Plausible.                        |
| 1.H.2 | Remove `ioredis` from `web/package.json` (completely unused — Redis not wired)                            | ✅     | `pnpm remove ioredis` via typecheck step.                                                       |
| 1.H.3 | `weatherSnapshots` schema: lat/lon/temp/precip/wind `text` → `real`                                       | ✅     | `schema.ts` updated. Migration `0001_burly_cardiac.sql` adds `DELETE` before `ALTER TYPE`.      |
| 1.H.4 | Update `refresh-weather.ts` to write numerics not strings                                                 | ✅     | Removes `String(...)` wrappers; passes `null` for missing values.                               |
| 1.H.5 | Plausible analytics in `layout.tsx` (conditional on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`)                       | ✅     | `<Script strategy="afterInteractive">` — no-op if env var unset. Added to `.env.example`.       |
| 1.H.6 | Add `reliefweb` source to seed; mark `ibex-media` inactive                                                | ✅     | ReliefWeb = UN OCHA, aggregates NDMA/PMD Pakistan reports. Ibex URL unverified → inactive.      |
| 1.H.7 | Write `worker/src/jobs/check-alerts.ts`: ReliefWeb JSON API + PMD Cheerio scraper                         | ✅     | GB-keyword filter, level/type inference, dedup by source_url. PMD logs selector miss for debug. |
| 1.H.8 | Wire `checkAlerts` into `worker/src/index.ts` (replaces `checkPdmaAlerts` stub)                           | ✅     | Hourly cron + startup run. Old `check-pdma.ts` stub retained but no longer imported.            |
| 1.H.9 | typecheck + lint + migration generate → commit                                                            | ✅     | Both packages clean. Migration committed.                                                       |

**LangGraph RAG Agent** → Phase 2.A (confirmed deferred by user).

**Known gaps after 1.H:**

- PMD page HTML structure unconfirmed — scraper logs a 500-char preview on selector miss; adjust selectors after first VPS run
- ReliefWeb covers national Pakistan reports; GB filtering by keyword (gilgit/baltistan/glof/skardu etc.) may miss some or include borderline items — review DB after first run
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` not set on VPS yet — add to root `.env` when Plausible account created
- `db:migrate` must run on VPS to apply `0001_burly_cardiac.sql` before restarting containers

---

# PHASE 2 — v2: AI agent + Bot + Multilingual

**Goal:** Serve on-ground GB residents. Add AI Q&A grounded in ingested events.
**Duration target:** 5–6 weeks after v1 stable.
**Prereq:** v1 running with ≥ 30 events + ≥ 2 weeks of alerts history.
**Exit criteria:** Telegram bot live, AI agent on web, Urdu translation working.

## 2.A — AI agent (RAG over events + alerts)

| #     | Task                                                                              | Status | Notes                                                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.A.1 | Add `pgvector` extension to self-hosted Postgres container                        | ✅     | `pgvector/pgvector:pg16` image in docker-compose. `db/init/00-extensions.sql` enables it. VPS: must also run `CREATE EXTENSION IF NOT EXISTS vector;` manually (see Deploy.md).                                                                                                          |
| 2.A.2 | Embed events on insert via worker cron (Jina AI `jina-embeddings-v3`, 1024-dim)   | 🟨     | `worker/src/jobs/embed-events.ts` built. `embedding_v1 vector(1024)` column added in migration 0002. **VPS BLOCKER:** column missing — pgvector was not loaded when migration ran. Manual fix: `ALTER TABLE events ADD COLUMN IF NOT EXISTS embedding_v1 vector(1024);` (see Deploy.md). |
| 2.A.3 | `/api/agent/query` SSE endpoint: LangGraph RAG pipeline with hybrid RRF retrieval | ✅     | `web/src/lib/agent/graph.ts` — guardrails → retrieve → generate. Hybrid pgvector + FTS. Node name conflict fix: `'blocked'` → `'blockQuery'`. OpenRouter fallback chain.                                                                                                                 |
| 2.A.4 | `/ask` page: chat UI, streaming SSE responses, cited sources with links           | ✅     | `web/src/app/ask/page.tsx`. Real-time token stream via `ReadableStream`.                                                                                                                                                                                                                 |
| 2.A.5 | Guardrails: refuse off-topic, political, medical/legal questions                  | ✅     | `web/src/lib/agent/guardrails.ts` — keyword + pattern check, no LLM cost.                                                                                                                                                                                                                |
| 2.A.6 | Rate limit: 20 queries/day per IP via Redis                                       | ⬜     | Redis already in stack. Not yet implemented.                                                                                                                                                                                                                                             |
| 2.A.7 | Log queries for offline improvement (`query_logs` table, no PII)                  | ✅     | Schema + Drizzle model added. Migration committed.                                                                                                                                                                                                                                       |
| 2.A.8 | Seed 22 verified GB events (2020–2024) for RAG corpus                             | ✅     | `web/scripts/seed-events.ts` — 22 real GLOF/flood/landslide events across 9 districts. `pnpm db:seed-events`. **VPS: not yet run** (depends on 2.A.2 fix).                                                                                                                               |
| 2.A.9 | VPS: run `--no-cache` web rebuild after graph.ts node fix                         | 🟨     | `docker compose build --no-cache web`. Blocked on user running VPS commands.                                                                                                                                                                                                             |

**VPS remaining sequence (must run in order):**

1. Fix `embedding_v1`: `docker compose exec postgres psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" climate_gb` then `ALTER TABLE events ADD COLUMN IF NOT EXISTS embedding_v1 vector(1024);`
2. `git pull` — gets seed-events.ts, graph.ts fix, updated Deploy.md
3. `docker compose --profile tools build tools && docker compose --profile tools run --rm tools pnpm db:seed-events`
4. `docker compose build --no-cache web && docker compose --profile app up -d web`
5. `docker compose restart worker` — watch `docker compose logs -f worker` for embed completion
6. Clean Pamir Times non-disaster alerts: `DELETE FROM alerts WHERE source_slug = 'pamir-times' AND title NOT ILIKE ANY(ARRAY['%flood%','%glof%','%glacial%','%landslide%','%earthquake%','%disaster%','%emergency%']);`

**Verification:** `curl -N 'https://<domain>/api/agent/query?q=Which+districts+had+the+most+GLOF+events'` returns grounded answer with event citations.
**Commit:** `feat: RAG-based AI agent with source citations` (all commits already pushed)

## 2.B — Telegram bot (+ Travel Info)

**Scope expansion (2026-07-23):** Bot should serve GB residents and travelers — not just disaster alerts. Key use cases:

1. Disaster alerts + GLOF warnings pushed to subscribers
2. Road/travel status ISB → Gilgit-Baltistan (KKH, Babusar Pass, Skardu road)
3. RAG Q&A grounded in verified event data (same `/api/agent/query` endpoint)
4. Weather briefing for major GB valleys

| #      | Task                                                                                       | Status | Notes                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 2.B.1  | Create bot via BotFather, save `TELEGRAM_BOT_TOKEN` to VPS `.env`                          | ⬜     |                                                                                                                     |
| 2.B.2  | Webhook endpoint `POST /api/telegram/webhook` in web container                             | ⬜     | Register with `setWebhook` to `https://<domain>/api/telegram/webhook`. Verify `TELEGRAM_SECRET_TOKEN` header.       |
| 2.B.3  | Core commands: `/latest`, `/alerts [district]`, `/weather [valley]`, `/ask <question>`     | ⬜     | `/latest` — last 5 verified events. `/alerts` — active DB alerts. `/weather` — last weather_snapshot. `/ask` — RAG. |
| 2.B.4  | Subscription table: `telegram_subs(chat_id, district, created_at)`                         | ⬜     | `subscribe <district>` / `unsubscribe`. Drizzle schema + migration.                                                 |
| 2.B.5  | Worker cron: push new alerts to district subscribers within 5 min of DB insert             | ⬜     | Hook into `check-alerts.ts` post-insert. Telegram `sendMessage` via Bot API.                                        |
| 2.B.6  | `/ask` proxies to RAG endpoint, truncates to 4000 chars, appends citations as inline links | ⬜     | Telegram max message = 4096 chars. Use `parse_mode: "HTML"`.                                                        |
| 2.B.7  | `/travel` command: KKH + Babusar + Skardu road status                                      | ⬜     | Scrape or cache NHSHA/PDMA road status pages. Fall back to "check official sources" if unavailable.                 |
| 2.B.8  | `/travel` enriched with active alerts along the route (cross-reference district)           | ⬜     | Match route districts against `alerts` table. "2 active warnings near Chilas."                                      |
| 2.B.9  | Rate limit: 10 `/ask` queries per user per day (Redis key `tg:rl:{chat_id}`)               | ⬜     | Prevents RAG abuse via bot.                                                                                         |
| 2.B.10 | Error handling: unknown command → help text, LLM timeout → fallback message                | ⬜     |                                                                                                                     |

**Verification:** From personal Telegram: `/latest`, `/alerts Hunza`, `/ask How many people were affected by GLOF in 2022?`, `/travel`. All return correct grounded data.
**Commit:** `feat: telegram bot with alerts, travel info, and Q&A`

**Future (after bot stable):** WhatsApp Business API (requires Meta approval + monthly cost — backlog until funded).

## 2.C — Multilingual (Urdu first)

| #     | Task                                                                         | Status | Notes                                |
| ----- | ---------------------------------------------------------------------------- | ------ | ------------------------------------ |
| 2.C.1 | Add `next-intl` for site i18n                                                | ⬜     |                                      |
| 2.C.2 | Translate UI strings: English → Urdu (native review)                         | ⬜     |                                      |
| 2.C.3 | Language switcher in header                                                  | ⬜     |                                      |
| 2.C.4 | AI agent detects query language, responds in same                            | ⬜     | Claude handles multilingual natively |
| 2.C.5 | Bot supports Urdu commands + responses                                       | ⬜     |                                      |
| 2.C.6 | Shina + Burushaski: initially transliterated Urdu; native speakers to review | ⬜     | Phase 3 refinement                   |

**Verification:** Switch to Urdu, all pages render RTL/Urdu correctly, agent responds in Urdu.
**Commit:** `feat: Urdu localization for web and bot`

## 2.E — Chitral Region Expansion

**Rationale:** Chitral (KPK) shares the Hindu Kush glacial system with GB. AKAH, UNDP GLOF-II, and ICIMOD all operate across both regions as a unit. Adding Chitral: (a) doubles addressable events/data, (b) aligns with AKAH's "GB & Chitral" admin region making partnership pitches stronger, (c) makes the platform cross-provincial → national significance.

**Branding decision needed:** Rename from "Climate Awareness GB" → **"Northern Pakistan Climate Watch"** (recommended) or "HKH Climate Watch". URL can lag behind; update when domain is purchased.

**Key Chitral geography:**

- **Districts:** Lower Chitral (Chitral city, Drosh, Golen), Upper Chitral (Mastuj, Yarkhun, Laspur, Mulkho)
- **Key valleys at risk:** Yarkhun, Mastuj, Golen, Lot Koh, Laspur
- **Rivers:** Chitral/Kunar River, Yarkhun River, Mastuj River
- **Glaciers:** Chiantar, Karambar Lake, Rosh Gol — all active GLOF sources
- **Travel route:** ISB → Dir → Lowari Tunnel → Chitral (alternative northern route)

| #     | Task                                                                                        | Status | Notes                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.E.1 | Update site branding + About page + metadata to reflect GB + Chitral scope                  | ⬜     | Rename in `layout.tsx` metadata, `about/page.tsx`, OG tags, sitemap description.                                                                                              |
| 2.E.2 | Add `pdma-kpk` and `chitral-times` to sources seed script                                   | ⬜     | `web/scripts/seed-sources.ts`. PDMA KPK = `pdma.kp.gov.pk`. Chitral Times = `chitral-times.net`.                                                                              |
| 2.E.3 | Extend seed events: 15–20 verified Chitral GLOF/flood events                                | ⬜     | Priority: 2015 Chitral floods (60+ dead), 2022 Golen Gol GLOF, 2023 Upper Chitral floods, 2020 Yarkhun flash flood. Sources: ReliefWeb, PDMA KPK, Pamir Times, Dawn archives. |
| 2.E.4 | Add PDMA KPK scraper to `check-alerts.ts` worker job                                        | ⬜     | Separate from PDMA GB. KPK PDMA has different page structure — inspect HTML before writing selectors.                                                                         |
| 2.E.5 | Map initial bounds: expand bbox to include Chitral (approx `[71.0, 35.0, 77.5, 37.5]`)      | ⬜     | Currently GB-only bounds. `MapView.tsx` initial `bounds` prop.                                                                                                                |
| 2.E.6 | District filter on map/alerts: add Upper Chitral + Lower Chitral options                    | ⬜     | `DISTRICTS` constant in filter components. Check consistent spelling with DB entries.                                                                                         |
| 2.E.7 | Bot `/travel`: add ISB→Chitral route (Dir/Lowari Tunnel) alongside KKH + Babusar + Skardu   | ⬜     | Part of 2.B bot — implement together when bot is built.                                                                                                                       |
| 2.E.8 | Outreach: personalized pitch to AKAH GB & Chitral using combined dataset                    | ⬜     | After ≥30 Chitral events in DB. Draft in `outreach/akah-pitch.md`.                                                                                                            |
| 2.E.9 | Khowar language: UI strings and bot responses (v3 refinement, native speaker review needed) | ⬜     | Khowar = primary language of Chitral. Phase 3 scope.                                                                                                                          |

**Exit criteria:** 30+ Chitral events in DB, map covers Chitral, PDMA KPK alerts scraping, branding updated.
**Commit:** `feat: expand coverage to Chitral region — seed events, map bounds, district filters, branding`

## 2.D — SMS fallback (optional, budget-dependent)

| #     | Task                                                                  | Status | Notes                 |
| ----- | --------------------------------------------------------------------- | ------ | --------------------- |
| 2.D.1 | Evaluate Twilio Pakistan SMS pricing + delivery reliability           | ⬜     | May be blocked by PTA |
| 2.D.2 | If viable: SMS opt-in via short code or web form                      | ⬜     |                       |
| 2.D.3 | Cron sends alert SMS to subscribers                                   | ⬜     | Budget cap 500 SMS/mo |
| 2.D.4 | If Twilio blocked: partner with local telco or use Jazz/Zong bulk SMS | ⬜     | Requires outreach     |

**Deploy checkpoint:** `v2.0.0`

---

# PHASE 3 — v3: Policy briefs + Community + Outreach

**Goal:** Reach Pakistani policy makers + international orgs + build volunteer network.
**Duration target:** 5–6 weeks.
**Prereq:** v2 live, 3 months of data, initial audience.
**Exit criteria:** Monthly PDF brief automated, 5+ active volunteers, 3+ partnerships confirmed.

## 3.A — Policy-ready reports

| #     | Task                                                    | Status | Notes                                                |
| ----- | ------------------------------------------------------- | ------ | ---------------------------------------------------- |
| 3.A.1 | PDF report template (LaTeX or Playwright→PDF)           | ⬜     | Cover, exec summary, map, event list, weather trends |
| 3.A.2 | Monthly cron generates PDF, uploads to Supabase storage | ⬜     |                                                      |
| 3.A.3 | Email distribution list (opt-in) sends monthly PDF      | ⬜     | Resend or Postmark, free tier                        |
| 3.A.4 | Public `/reports` archive page                          | ⬜     |                                                      |
| 3.A.5 | Urdu policy brief version (short, 2 pages)              | ⬜     |                                                      |

## 3.B — Community submissions

| #     | Task                                                            | Status | Notes     |
| ----- | --------------------------------------------------------------- | ------ | --------- |
| 3.B.1 | Public submission form: post URL + description + rough location | ⬜     | reCAPTCHA |
| 3.B.2 | Volunteer moderator role in admin (approve/reject)              | ⬜     |           |
| 3.B.3 | Submission queue with dedupe check                              | ⬜     |           |
| 3.B.4 | Notify moderators on new submission (email or Telegram)         | ⬜     |           |
| 3.B.5 | Public leaderboard (opt-in) recognizing top contributors        | ⬜     | Optional  |

## 3.C — Outreach + partnerships

| #     | Task                                                                       | Status | Notes               |
| ----- | -------------------------------------------------------------------------- | ------ | ------------------- |
| 3.C.1 | Draft outreach templates: ICIMOD, AKAH, UNDP GLOF-II, Pamir Times, Reuters | ⬜     | Save in `outreach/` |
| 3.C.2 | Personalized send with data snapshot (last 3 months)                       | ⬜     |                     |
| 3.C.3 | Media kit: logo, screenshots, one-pager, contact                           | ⬜     |                     |
| 3.C.4 | Track responses in `outreach/log.md`                                       | ⬜     |                     |
| 3.C.5 | Publish "Data Partnership" page for orgs to co-sponsor                     | ⬜     |                     |

## 3.D — Analytics + iteration

| #     | Task                                                        | Status | Notes                    |
| ----- | ----------------------------------------------------------- | ------ | ------------------------ |
| 3.D.1 | Dashboard: pageviews, shares, top events, subscriber growth | ⬜     | Internal only            |
| 3.D.2 | Monthly retrospective note in `retros/`                     | ⬜     | What worked, what to cut |
| 3.D.3 | Roadmap v4: what's next based on real usage                 | ⬜     |                          |

**Deploy checkpoint:** `v3.0.0`

---

# BACKLOG (post-v3, unranked)

- Fix ReliefWeb scraper: HTTP 410 — API endpoint deprecated. Check ReliefWeb API v1 docs for new endpoint or switch to `https://api.reliefweb.int/v1/reports` with `?filter[field]=country&filter[value]=Pakistan&filter[field]=tags&filter[value]=Disaster+Preparedness`.
- Khowar (Chitrali) language support for bot + UI — requires native speaker review. Phase 3.
- Native Shina + Burushaski translation with local reviewers
- Offline PWA for low-connectivity users
- Satellite imagery diff before/after events (Sentinel Hub)
- Historical GLOF archive (pre-2020) from ICIMOD datasets
- WhatsApp Business API integration (when funded)
- Volunteer training program + docs
- Mobile app (React Native) if analytics show mobile-heavy usage
- Integration with ReliefWeb / OCHA for global disaster context
- Predictive risk model per valley (ML, requires historical labeled data)

---

# WORKING LOG

Append short dated entries as work progresses. Newest at top.

## 2026-07-23 (session 3 — Chitral expansion planning)

- **Scope expanded:** Platform renamed "Northern Pakistan Climate Watch". GB + Chitral now joint coverage area.
- **Strategic rationale:** AKAH "GB & Chitral" admin unit, UNDP GLOF-II 16-district footprint includes Chitral, ICIMOD HKH mandate. Aligning scope = stronger partnership case.
- **idea.md updated:** Problem statement, mission, objectives (O7 added), audiences, sources whitelist all updated.
- **plan.md:** Phase 2.E added (9 tasks: branding, new seed events, PDMA KPK scraper, map bounds, district filters, bot `/travel` Chitral route, Khowar language).
- **Key Chitral events to seed next session:** 2015 Chitral floods, 2022 Golen Gol GLOF, 2023 Upper Chitral floods, 2020 Yarkhun flash flood.
- **Next session priorities:** VPS fix sequence (2.A) → verify RAG → start 2.B (bot) → 2.E (Chitral seed events).

## 2026-07-23 (session 2 — RAG + deploy)

- **Phase 2.A nearly complete.** LangGraph RAG pipeline live (`graph.ts`): guardrails → retrieve → generate. Hybrid pgvector + FTS with RRF fusion. OpenRouter LLM fallback. Streaming SSE on `/ask` page.
- **Fixed:** LangGraph build crash — node name `'blocked'` conflicted with state annotation field. Renamed to `'blockQuery'`. Commit: `fix(rag): rename graph node 'blocked' to 'blockQuery' to avoid LangGraph state channel conflict`.
- **Created:** `web/scripts/seed-events.ts` — 22 real verified GB GLOF/flood/landslide events (2020–2024), 9 districts, cited sources (NDMA/ICIMOD/ReliefWeb/Pamir Times). `pnpm db:seed-events`.
- **Deploy.md** rewritten with correct VPS path (`~/docker/apps/climate_awareness/climate_awareness`), SSH address (`ssh qalmaq@100.90.23.36`), manual `embedding_v1` fix, seed-events step, alert cleanup SQL, NPM Basic Auth note, 5 new troubleshooting entries.
- **VPS pending (user to run):** embedding_v1 column fix → git pull → seed-events → --no-cache web rebuild → worker restart → Pamir Times alert cleanup. See 2.A VPS sequence above.
- **Alert page:** Pamir Times scraper now has DISASTER_KEYWORDS filter, but old non-disaster articles already in DB. SQL DELETE needed (see 2.A step 6).
- **ReliefWeb:** HTTP 410 — API endpoint deprecated/moved. Not critical (other scrapers running). Fix deferred to backlog.
- **Next session:** Run VPS sequence → verify RAG with real queries → start 2.B Telegram bot.
- **Idea:** Telegram bot to also serve travel info (ISB→GB road status, KKH/Babusar/Skardu) + RAG Q&A. Added as 2.B scope expansion.

## 2026-07-23 (session 1)

- Phase 1.A ✅ (except docker build verification in progress). Next.js 16.2.11 + React 19 + Tailwind 4 + TS 5.9 scaffolded in `web/`.
- Installed runtime deps: drizzle-orm, pg, next-auth@beta (v5), @auth/drizzle-adapter, maplibre-gl, react-map-gl, zod, date-fns, ioredis, bcryptjs. Dev: drizzle-kit, @types/pg.
- pnpm 11.15.1 via corepack. `pnpm-workspace.yaml` grants build permission to esbuild+sharp+unrs-resolver.
- Wrote `web/Dockerfile` (multi-stage, node:20-alpine, non-root user, HEALTHCHECK), `web/.dockerignore`, `web/.env.example`.
- Base layout with Inter font + slate/teal palette. Header + footer + 4 pages (/, /map, /alerts, /about) + not-found + error boundary.
- `next.config.ts` set to `output: "standalone"` for lean Docker image.
- `pnpm build`: 5 static routes prerendered. Typecheck + lint clean.
- **Next:** confirm docker build passes, commit Phase 1.A, move to 1.B (Drizzle schema + migrations).

## 2026-07-22 (update 3)

- Wrote `README.md`, `.gitignore`, `docker-compose.yml` (validated), `.env.example`, `db/init/00-extensions.sql`.
- First commit `79a2c82` on `main`: 9 files, +1078 lines.
- GitHub push deferred (user choice). Local-only until Phase 1.G.
- Wrote `docs/deploy-runbook.md` covering Phase 0 tasks 0.8–0.12 (VPS provisioning, DNS/NPM, backup + restore drill). User executes on VPS. Tasks marked 🟨 (docs ready) until user runs and confirms.
- Wrote executable `bin/pg-backup.sh` for nightly Postgres → Backblaze B2 backups via rclone.
- **Next:** either (a) user runs runbook on VPS and marks 0.8–0.12 ✅, or (b) skip to Phase 1.A (Next.js scaffold) and provision VPS later before deploy.

## 2026-07-22 (update 2)

- **Stack switch: self-hosted on Hostinger VPS.** Drops Vercel + managed Supabase entirely. Existing infra: Docker + Nginx Proxy Manager + Cloudflare. VPS specs: 8GB RAM, 100GB disk.
- Locked additions: fresh Postgres 16 + PostGIS container, Redis 7, NextAuth.js (credentials + Drizzle adapter), `worker` container for cron jobs (node-cron), docker-compose in repo, nightly pg_dump → Backblaze B2 / R2 backup.
- Phase 0 expanded to tasks 0.5–0.12 (git, GitHub, compose skeleton, VPS provisioning, DNS, backups). See §Infra reference in Phase 0.
- Phase 1.A adds Dockerfile + standalone Next.js build. Phase 1.B swaps Supabase migrations → Drizzle Kit. Phase 1.D swaps Supabase Auth → NextAuth credentials. Phase 1.E adds `worker/` container. Phase 1.G becomes `docker compose up` on VPS behind NPM + Cloudflare.
- Phase 2.A pgvector = same Postgres container (add extension). Phase 2.B webhook served by web container.
- Budget: **~$0/mo incremental**. Only new cost = domain (~$15/yr).

## 2026-07-22

- Phase 0 tasks 0.1–0.4 done. Research saved to `research/gb-situation.md` + `research/data-sources.md`. Project memory initialized (4 files + MEMORY.md).
- **Big finding:** Meta oEmbed became tokenless on June 15, 2026 — no app registration needed for FB/IG/Threads embeds. Simplifies Phase 1.D.
- Confirmed active GB 2026 monsoon crisis: PMD issued 2 GLOF alerts in June, 47 dead nationally by July 22, Diamer + Ghizer districts most-hit. Site launch before August peak matters.
- Locked stack: Next.js 15 + TypeScript + MapLibre + Supabase + Vercel. Budget <$50/mo solo. Outreach deferred per user (build first, pitch later).
- Created `idea.md` + `plan.md`. v1 scope: map + verified feed + weather/GLOF alerts. v1 audience: international orgs + media + diaspora.
- **Next:** Phase 0 tasks 0.5–0.8 (git init, GitHub, Supabase, Vercel accounts). Then Phase 1.A scaffold.
