# Climate Awareness GB — Implementation Plan

**Companion to:** `idea.md`
**Last updated:** 2026-07-22
**Current phase:** Phase 0 (setup)
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

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Web-search current GB flood situation (2026 monsoon), latest events, active orgs | ✅ | Saved to `research/gb-situation.md` |
| 0.2 | Verify data endpoints: PDMA GB feed URL, NDMA API, ICIMOD RDS, Open-Meteo | ✅ | Saved to `research/data-sources.md` |
| 0.3 | Verify Meta oEmbed access requirements (app registration, token flow) | ✅ | **Tokenless since Jun 15 2026**. Covered in `research/data-sources.md`. No separate file needed. |
| 0.4 | Save project memory (`~/.claude/projects/-Users-jawadhaider-Climate-Awareness/memory/`) | ✅ | 4 files + MEMORY.md index |
| 0.5 | Init git repo (`git init` done by user) + first commit with `README.md`, `idea.md`, `plan.md`, `research/`, `docker-compose.yml`, `.env.example`, `.gitignore`, `db/init/` | 🟨 | Files staged; commit pending user go-ahead |
| 0.6 | Create GitHub repo (private initially), push | ⬜ | Repo name: `climate-awareness-gb`. Need remote URL from user or `gh` CLI. |
| 0.7 | Draft root `docker-compose.yml` skeleton: `postgres`, `redis`, `web` (Next.js), `worker` (cron) | ✅ | YAML validated with `docker compose config`. Uses `postgis/postgis:16-3.4`, Redis 7, internal `climate_net`, ports bound to `127.0.0.1`. See §Infra reference below. |
| 0.8 | Provision on VPS: create project dir `/opt/climate-gb/`, clone repo, add `.env` (not committed) | ⬜ | Ensure Docker + Compose v2 installed |
| 0.9 | Bring up `postgres` + `redis` on VPS, verify PostGIS enabled, verify healthchecks | ⬜ | `docker compose up -d postgres redis` |
| 0.10 | Create Cloudflare DNS record → VPS IP; add proxy host in NPM (HTTP → app container:3000, force SSL via Let's Encrypt) | ⬜ | Subdomain choice deferred to 0.11 |
| 0.11 | Pick + buy domain (`climate-gb.org` or similar, ~$15/yr) or use existing subdomain | ⬜ | Update Cloudflare + NPM |
| 0.12 | Configure nightly `pg_dump` cron on VPS → encrypted upload (Backblaze B2 or Cloudflare R2 free tier) | ⬜ | Small shell script + systemd timer or crontab |

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
      test: ["CMD-SHELL", "pg_isready -U climate_gb -d climate_gb"]
      interval: 10s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
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
    ports: ["127.0.0.1:3000:3000"]     # NPM proxies to this
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

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.A.1 | `npx create-next-app@latest web` with TypeScript, App Router, Tailwind, ESLint | ⬜ | Name: `web/` inside repo root |
| 1.A.2 | Install: `pg`, `drizzle-orm` (or `prisma`), `next-auth@beta`, `@auth/drizzle-adapter`, `maplibre-gl`, `react-map-gl/maplibre`, `zod`, `date-fns`, `ioredis` | ⬜ | ORM pick: Drizzle (lighter, better types). Confirm before install. |
| 1.A.3 | Env setup: `.env.local` (dev) + `.env.example` (committed) with `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | ⬜ | |
| 1.A.4 | Configure `next.config.js` with `output: 'standalone'` for lean Docker image | ⬜ | |
| 1.A.5 | Write `web/Dockerfile` (multi-stage: deps → build → runner) | ⬜ | Node 20-alpine base |
| 1.A.6 | Base layout: header (logo + nav Map/Alerts/About), footer (attribution) | ⬜ | Tailwind. Mobile-first. |
| 1.A.7 | Placeholder pages: `/`, `/map`, `/alerts`, `/about` | ⬜ | Server components |
| 1.A.8 | Global styles + typography (Inter font, neutral palette, single accent) | ⬜ | |
| 1.A.9 | 404 + error boundary | ⬜ | |
| 1.A.10 | Local dev: `docker compose up postgres redis` + `cd web && npm run dev` | ⬜ | Verify DB reachable |

**Verification:** `npm run dev` → all pages render, nav works, DB connection OK. Also `docker compose build web && docker compose up web` locally succeeds.
**Commit:** `feat: scaffold Next.js app, Dockerfile, base layout, routing`

## 1.B — Postgres/PostGIS schema + migrations (Week 1)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.B.1 | Enable extensions on first boot: `postgis`, `pgcrypto` (for `gen_random_uuid`) | ⬜ | Init SQL in `db/init/00-extensions.sql` mounted via docker-compose |
| 1.B.2 | Choose migration tool: Drizzle Kit (recommended) or Prisma Migrate | ⬜ | Drizzle for lightweight + geo type support |
| 1.B.3 | Define `sources` schema | ⬜ | Whitelisted orgs table |
| 1.B.4 | Define `events` schema with `geography(Point)` column | ⬜ | See SQL reference below |
| 1.B.5 | Define `alerts` schema | ⬜ | |
| 1.B.6 | Define `weather_snapshots` schema | ⬜ | |
| 1.B.7 | Define NextAuth tables (`users`, `accounts`, `sessions`, `verification_tokens`) via `@auth/drizzle-adapter` schema | ⬜ | |
| 1.B.8 | Enforce app-layer access control (admin routes only): no RLS needed since only server-side queries | ⬜ | RLS optional; can add later |
| 1.B.9 | Seed script `db/seed.ts` inserts whitelisted sources | ⬜ | Pamir Times, Ibex, PDMA, NDMA, AKAH, ICIMOD, UNDP |
| 1.B.10 | Server DB client in `web/lib/db.ts` (Drizzle instance + typed queries) | ⬜ | |
| 1.B.11 | Migration workflow docs in `db/README.md` | ⬜ | `drizzle-kit generate` + `drizzle-kit migrate` |

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

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.C.1 | `/map` client component with MapLibre + OSM tiles | ⬜ | Center on Gilgit ~35.9°N 74.3°E, zoom 8 |
| 1.C.2 | Server action to fetch events (filter by date + type + district) | ⬜ | |
| 1.C.3 | Render pins with clustering (supercluster) | ⬜ | |
| 1.C.4 | Pin colors by `event_type`, size by `severity` | ⬜ | |
| 1.C.5 | Sidebar filter panel: event type checkboxes, date range, district select | ⬜ | |
| 1.C.6 | Click pin → popup with summary + source link + "View details" | ⬜ | |
| 1.C.7 | Event detail page `/events/[id]` with oEmbed render + weather-at-time | ⬜ | |
| 1.C.8 | GB boundary overlay (GeoJSON from OSM or admin dataset) | ⬜ | Visual context |

**Verification:** Manually seed 10 events across GB districts; verify clustering, filters, detail pages.
**Commit:** `feat: interactive map with event pins, filters, detail view`

## 1.D — Admin panel + NextAuth + Meta oEmbed (Week 2–3)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.D.1 | Meta oEmbed integration (tokenless, no app registration) | ⬜ | Server fetch → parse JSON. Add token fallback path in abstraction. |
| 1.D.2 | NextAuth.js config with Credentials provider + Drizzle adapter | ⬜ | `web/app/api/auth/[...nextauth]/route.ts` |
| 1.D.3 | Admin allowlist: seed 1-3 admin users with bcrypt-hashed passwords via CLI script | ⬜ | `pnpm tsx scripts/create-admin.ts <email>` |
| 1.D.4 | `/admin` route + middleware: reject if not authenticated + not in admin role | ⬜ | Middleware check role from session |
| 1.D.5 | New event form: paste URL → server fetches oEmbed → prefill form | ⬜ | Support FB + IG URLs |
| 1.D.6 | Manual fields: event type, severity, occurred_at, valley, district, lat/lng picker | ⬜ | Lat/lng via map click |
| 1.D.7 | Save event → server action → Drizzle insert | ⬜ | |
| 1.D.8 | Edit + delete existing events | ⬜ | Soft-delete preferred (deleted_at) |
| 1.D.9 | Admin dashboard: event count, pending review queue, recent alerts | ⬜ | |

**Verification:** Log in, create event via oEmbed, edit it, delete it. All flows work.
**Commit:** `feat: admin panel with Meta oEmbed ingestion`

## 1.E — Alerts + weather + worker cron (Week 3)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.E.1 | Confirm PDMA GB feed source (RSS? scrape?). Document in `research/` | ⬜ | Try `pmd.gov.pk`, `ndma.gov.pk` first — likely more accessible |
| 1.E.2 | Build `worker/` service (Node + TypeScript + `node-cron`) in Docker | ⬜ | Separate container from `web/`, shares DB |
| 1.E.3 | Cron job: hourly `refresh-alerts` — Cheerio scrape → upsert into `alerts` (dedupe by `source_url`) | ⬜ | |
| 1.E.4 | `/alerts` page: list active alerts, severity badges, region filter | ⬜ | |
| 1.E.5 | Home page shows top 3 active alerts | ⬜ | |
| 1.E.6 | Open-Meteo integration in worker: refresh weather cache for pinned valleys every 6h | ⬜ | Store in `weather_snapshots` |
| 1.E.7 | On new event save: web triggers on-demand weather snapshot fetch (historical Open-Meteo `/archive`) | ⬜ | |
| 1.E.8 | Event detail page shows weather-at-time (nearest snapshot) | ⬜ | |
| 1.E.9 | Worker logs to stdout → Docker log driver → optional Loki/Promtail later | ⬜ | Keep simple v1 |

**Verification:** Trigger cron manually, confirm alerts appear, weather renders on event page.
**Commit:** `feat: alerts feed + weather integration via cron`

## 1.F — Home page + share + polish (Week 4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.F.1 | Home hero: map preview, live stats ("N events in 30 days", "N alerts active") | ⬜ | |
| 1.F.2 | Recent events feed (3 latest with embed) | ⬜ | |
| 1.F.3 | Share buttons: Twitter/X, Facebook, WhatsApp, copy link | ⬜ | Pre-filled with tag suggestions |
| 1.F.4 | About page: mission, sources, editorial policy, contact | ⬜ | Copy from `idea.md` §2, §6 |
| 1.F.5 | Take Action page: how to share, orgs to tag, donation links (AKAH, UNDP) | ⬜ | |
| 1.F.6 | SEO: metadata, OpenGraph, sitemap, robots.txt | ⬜ | |
| 1.F.7 | Analytics: Plausible or Vercel Analytics (privacy-friendly) | ⬜ | |
| 1.F.8 | Accessibility pass: alt text, keyboard nav, color contrast | ⬜ | |
| 1.F.9 | Open data endpoint: `/api/events.geojson` + `/api/events.csv` | ⬜ | Public, CORS enabled |

**Verification:** Full manual click-through, Lighthouse ≥ 90 on all pages, share links work in prod.
**Commit:** `feat: home page, share, take action, open data, SEO`

## 1.G — Deploy v1 to VPS (End of Week 4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.G.1 | On VPS: `cd /opt/climate-gb && git pull && docker compose build web worker && docker compose up -d` | ⬜ | Also apply migrations: `docker compose run --rm web pnpm db:migrate` |
| 1.G.2 | NPM proxy host: subdomain → `web:3000`, force SSL (Let's Encrypt), Cloudflare in front | ⬜ | Websockets on if needed for MapLibre HMR (prod: no HMR) |
| 1.G.3 | Verify Cloudflare cache rules (bypass on `/admin`, `/api/*`; cache static assets) | ⬜ | |
| 1.G.4 | Seed 10–20 verified events from Pamir Times + Ibex last 6 months | ⬜ | Manual via admin |
| 1.G.5 | Smoke test in production: home, map, event detail, alerts, admin login, oEmbed | ⬜ | |
| 1.G.6 | Confirm nightly `pg_dump` backup ran + upload succeeded | ⬜ | |
| 1.G.7 | Tag release `v1.0.0` | ⬜ | |
| 1.G.8 | Simple deploy script `bin/deploy.sh` (git pull + compose build + compose up + migrate + healthcheck) | ⬜ | Idempotent |
| 1.G.9 | Announce on personal Twitter/LinkedIn (soft launch) | ⬜ | |

**Exit v1.** Move to Phase 2 planning check.

---

# PHASE 2 — v2: AI agent + Bot + Multilingual

**Goal:** Serve on-ground GB residents. Add AI Q&A grounded in ingested events.
**Duration target:** 5–6 weeks after v1 stable.
**Prereq:** v1 running with ≥ 30 events + ≥ 2 weeks of alerts history.
**Exit criteria:** Telegram bot live, AI agent on web, Urdu translation working.

## 2.A — AI agent (RAG over events + alerts)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.A.1 | Add `pgvector` extension to self-hosted Postgres container | ⬜ | Use `pgvector/pgvector:pg16` image or add extension init SQL. Reserve if switching image mid-project needs data migration. |
| 2.A.2 | Embed events + alerts on insert (Voyage or OpenAI embeddings) | ⬜ | Batch backfill existing |
| 2.A.3 | `/api/agent/query` endpoint: retrieve top-k via pgvector, prompt Claude, return with citations | ⬜ | Use Anthropic SDK, enable prompt caching |
| 2.A.4 | `/ask` page: chat UI, streaming responses, cited sources with links | ⬜ | |
| 2.A.5 | Guardrails: refuse political questions, redirect to sources, no medical/legal advice | ⬜ | System prompt |
| 2.A.6 | Rate limit: 20 queries/day per IP — use self-hosted Redis already in stack | ⬜ | |
| 2.A.7 | Log queries for offline improvement (no PII stored) | ⬜ | |

**Verification:** 10 test queries return grounded answers with correct citations.
**Commit:** `feat: RAG-based AI agent with source citations`

## 2.B — Telegram bot

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.B.1 | Create bot via BotFather, save token | ⬜ | |
| 2.B.2 | Webhook endpoint `/api/telegram/webhook` served from `web` container behind NPM | ⬜ | Set Telegram webhook to `https://<domain>/api/telegram/webhook` |
| 2.B.3 | Commands: `/latest`, `/alerts`, `/subscribe <valley>`, `/ask <question>` | ⬜ | |
| 2.B.4 | Subscription table: user_id + valley → push new alerts for that valley | ⬜ | |
| 2.B.5 | Cron sends alerts to subscribers when new PDMA/NDMA warning matches | ⬜ | |
| 2.B.6 | Bot proxies `/ask` to same RAG endpoint | ⬜ | Trim response to Telegram limits |

**Verification:** Subscribe from personal Telegram, trigger test alert, confirm receipt.
**Commit:** `feat: telegram bot with subscriptions and Q&A`

## 2.C — Multilingual (Urdu first)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.C.1 | Add `next-intl` for site i18n | ⬜ | |
| 2.C.2 | Translate UI strings: English → Urdu (native review) | ⬜ | |
| 2.C.3 | Language switcher in header | ⬜ | |
| 2.C.4 | AI agent detects query language, responds in same | ⬜ | Claude handles multilingual natively |
| 2.C.5 | Bot supports Urdu commands + responses | ⬜ | |
| 2.C.6 | Shina + Burushaski: initially transliterated Urdu; native speakers to review | ⬜ | Phase 3 refinement |

**Verification:** Switch to Urdu, all pages render RTL/Urdu correctly, agent responds in Urdu.
**Commit:** `feat: Urdu localization for web and bot`

## 2.D — SMS fallback (optional, budget-dependent)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.D.1 | Evaluate Twilio Pakistan SMS pricing + delivery reliability | ⬜ | May be blocked by PTA |
| 2.D.2 | If viable: SMS opt-in via short code or web form | ⬜ | |
| 2.D.3 | Cron sends alert SMS to subscribers | ⬜ | Budget cap 500 SMS/mo |
| 2.D.4 | If Twilio blocked: partner with local telco or use Jazz/Zong bulk SMS | ⬜ | Requires outreach |

**Deploy checkpoint:** `v2.0.0`

---

# PHASE 3 — v3: Policy briefs + Community + Outreach

**Goal:** Reach Pakistani policy makers + international orgs + build volunteer network.
**Duration target:** 5–6 weeks.
**Prereq:** v2 live, 3 months of data, initial audience.
**Exit criteria:** Monthly PDF brief automated, 5+ active volunteers, 3+ partnerships confirmed.

## 3.A — Policy-ready reports

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.A.1 | PDF report template (LaTeX or Playwright→PDF) | ⬜ | Cover, exec summary, map, event list, weather trends |
| 3.A.2 | Monthly cron generates PDF, uploads to Supabase storage | ⬜ | |
| 3.A.3 | Email distribution list (opt-in) sends monthly PDF | ⬜ | Resend or Postmark, free tier |
| 3.A.4 | Public `/reports` archive page | ⬜ | |
| 3.A.5 | Urdu policy brief version (short, 2 pages) | ⬜ | |

## 3.B — Community submissions

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.B.1 | Public submission form: post URL + description + rough location | ⬜ | reCAPTCHA |
| 3.B.2 | Volunteer moderator role in admin (approve/reject) | ⬜ | |
| 3.B.3 | Submission queue with dedupe check | ⬜ | |
| 3.B.4 | Notify moderators on new submission (email or Telegram) | ⬜ | |
| 3.B.5 | Public leaderboard (opt-in) recognizing top contributors | ⬜ | Optional |

## 3.C — Outreach + partnerships

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.C.1 | Draft outreach templates: ICIMOD, AKAH, UNDP GLOF-II, Pamir Times, Reuters | ⬜ | Save in `outreach/` |
| 3.C.2 | Personalized send with data snapshot (last 3 months) | ⬜ | |
| 3.C.3 | Media kit: logo, screenshots, one-pager, contact | ⬜ | |
| 3.C.4 | Track responses in `outreach/log.md` | ⬜ | |
| 3.C.5 | Publish "Data Partnership" page for orgs to co-sponsor | ⬜ | |

## 3.D — Analytics + iteration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.D.1 | Dashboard: pageviews, shares, top events, subscriber growth | ⬜ | Internal only |
| 3.D.2 | Monthly retrospective note in `retros/` | ⬜ | What worked, what to cut |
| 3.D.3 | Roadmap v4: what's next based on real usage | ⬜ | |

**Deploy checkpoint:** `v3.0.0`

---

# BACKLOG (post-v3, unranked)

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

## 2026-07-22 (update 3)
- Wrote `README.md`, `.gitignore`, `docker-compose.yml` (validated), `.env.example`, `db/init/00-extensions.sql`.
- Git `init` already done by user (branch `main`, no commits, no remote). Files staged for first commit.
- **Next:** confirm commit + get GitHub remote URL to push. Then Phase 0 tasks 0.8–0.12 (VPS provisioning, DNS/NPM, backups) which need VPS SSH access.

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
