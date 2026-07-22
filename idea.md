# Climate Awareness GB — Idea Document

**Owner:** Jawad Haider
**Started:** 2026-07-22
**Status:** Pre-build, planning phase
**Working directory:** `/Users/jawadhaider/Climate Awareness/`

---

## 1. Problem

Gilgit-Baltistan (GB), Pakistan faces recurring Glacial Lake Outburst Floods (GLOFs), flash floods, landslides. Villages, farmland, livestock, homes destroyed each monsoon season.

Compounding failures:
- **No prevention infrastructure.** Only post-disaster aid.
- **Broken connectivity.** No stable internet in most valleys. Cell networks fail 2 days to 2 weeks at a time.
- **Poor road infrastructure.** Cuts off relief and evacuation.
- **Scattered information.** News on Pamir Times, Ibex Media Network, various FB/IG pages. No aggregation. No map. No memory.
- **Low international visibility.** GB climate crisis under-reported vs. other South Asian regions.

## 2. Mission

Raise awareness of the GB climate crisis by aggregating verified reports, mapping impact geographically, surfacing weather/GLOF alerts, and giving international orgs, media, diaspora, and eventually residents a single source of truth.

**Not** a criticism platform. Neutral framing. Data speaks. Government, army, NGOs are potential partners, not targets.

## 3. Objectives

| # | Objective | Success signal |
|---|-----------|----------------|
| O1 | Aggregate verified GLOF/flood events on interactive GB map | 50+ events pinned in 3 months |
| O2 | Surface official weather + GLOF alerts alongside events | PDMA/NDMA feed live daily |
| O3 | Enable low-friction sharing to amplify signal | 1000+ shares in first 6 months |
| O4 | Reach ICIMOD, UNDP GLOF-II, AKAH, international climate press | 3+ partnerships or citations by month 6 |
| O5 | Serve on-ground GB residents with alerts (v2) | SMS/Telegram bot with 500+ subscribers |
| O6 | Provide policy-ready reports (v3) | Monthly PDF distributed to NDMA + Senate committees |

## 4. Non-goals (explicit cuts)

- Not a fundraising platform (link out to AKAH/UNDP instead).
- Not a crowdsourced rumor mill (verified sources only).
- Not a criticism/blame tracker.
- Not a chat/social platform (no comments v1).
- Not scraping FB/IG (Meta oEmbed only).

## 5. Audiences (phased)

| Phase | Primary | Language | Delivery |
|-------|---------|----------|----------|
| v1 | International orgs, media, diaspora | English | Web |
| v2 | GB residents on-ground | Urdu, Shina, Burushaski | SMS, Telegram, WhatsApp bot |
| v3 | Pakistani policy stakeholders (NDMA, Senate, national media) | English + Urdu | Web + PDF briefs |

## 6. Guiding principles

1. **Legal by default.** Only oEmbed for social content. Attribute every source. No unauthorized rehosting.
2. **Neutral framing.** "Impact tracker" not "failure tracker."
3. **Ship small, ship often.** Each phase deployable and useful standalone.
4. **Offline-hostile-friendly.** Assume audience has bandwidth; but design so ground users can reach us via SMS in v2.
5. **Open data.** All curated event data downloadable as CSV/GeoJSON. Researchers welcome.
6. **Solo-scalable.** No feature requires a team to maintain.
7. **Root-cause fixes.** No fragile scraping, no shortcuts that break Meta ToS.

## 7. Sources of truth (verified whitelist)

- **Pamir Times** — GB regional news, FB + web
- **Ibex Media Network** — GB video journalism, FB + IG
- **PDMA GB** — Provincial Disaster Management Authority official
- **NDMA Pakistan** — National Disaster Management Authority
- **AKAH (Aga Khan Agency for Habitat)** — largest on-ground actor, drone maps + hazard data
- **ICIMOD** — International Centre for Integrated Mountain Development, HKH GLOF research
- **UNDP GLOF-II Project Pakistan** — active donor + monitoring

Add sources only after manual verification. Track additions in `sources.md` (created when needed).

## 8. Tech direction (locked for v1)

**Self-hosted on Hostinger VPS** (8GB RAM, 100GB storage). Existing infra: Docker, Nginx Proxy Manager (NPM), Cloudflare DNS/proxy.

- Next.js 15 App Router + TypeScript, standalone build in Docker
- MapLibre GL + OpenStreetMap tiles
- Postgres 16 + PostGIS extension (fresh Docker container, dedicated volume)
- NextAuth.js with credentials provider + Postgres adapter (admin auth)
- Redis 7 (rate limits + cache) — small container
- MinIO or local volume for static assets (avoid until needed)
- Meta oEmbed (tokenless as of Jun 2026)
- Open-Meteo for weather (free, no key)
- **Scheduling:** `node-cron` inside a small worker container (or Next.js route + system cron) for periodic refresh
- **Deploy:** `docker-compose.yml` in repo. `git pull && docker compose up -d --build`. NPM handles TLS + reverse proxy.
- **DNS:** Cloudflare → NPM → app container

Budget target: **~$0/mo incremental** (VPS already paid). Only cost = domain (~$15/yr).

## 9. Risks + mitigations

| Risk | Mitigation |
|------|------------|
| Meta revokes oEmbed access | Fall back to plain source link + screenshot with permission |
| Volunteer content pipeline dries up | Automate PDMA/NDMA ingestion first (independent of volunteers) |
| Traffic never comes | Outreach to ICIMOD/AKAH/journalists after 3 months of data |
| Site politicized against govt | Written editorial policy; reject partisan submissions |
| Solo burnout | Everything documented in plan.md; anyone can pick up from any phase |
| Legal issue (defamation, copyright) | Attribution + oEmbed + no personal victim data without consent |
| VPS down / disk full / RAM pressure | Daily Postgres dump to off-box storage; monitor with existing NPM/host stack; keep container resource limits |
| Postgres data loss | Nightly `pg_dump` cron → encrypted upload to remote (Backblaze B2 or R2, both cheap/free tier) |
| DDoS or spike | Cloudflare in front of NPM absorbs most; rate-limit at app + Redis |

## 10. Timeline (high-level)

- **v1 (Weeks 1–4):** Map + verified feed + weather/GLOF alerts. Ship public.
- **v2 (Weeks 5–10):** AI agent (RAG over events) + Telegram/SMS bot + multilingual support.
- **v3 (Weeks 11–16):** Policy briefs, PDF exports, submission workflow, community volunteers, outreach campaign.

Detailed phase breakdown → `plan.md`.

## 11. Next action

Follow `plan.md` phase by phase. Each phase has entry criteria, tasks, exit criteria, and commit/deploy checkpoint.
