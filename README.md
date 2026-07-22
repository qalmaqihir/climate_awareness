# Climate Awareness GB

Interactive map + verified feed + weather/GLOF alerts for the ongoing climate crisis in **Gilgit-Baltistan, Pakistan**. Neutral advocacy, not blame. Aggregates verified reports from local media and official disaster-management sources so the crisis becomes visible internationally, domestically, and to the diaspora.

> **Status:** Phase 0 (foundations). Not yet deployed. See [`plan.md`](plan.md).

## Why this exists

Every monsoon, Glacial Lake Outburst Floods (GLOFs), flash floods, and landslides destroy villages, crops, livestock, and infrastructure across GB. Warnings arrive; prevention rarely does. Coverage is scattered across Pamir Times, Ibex Media Network, PDMA/NDMA advisories, and community Facebook/Instagram pages — with no aggregation, no map, no memory.

This project builds a single, verifiable source of truth: **where** each event happened, **when**, **what** was lost, **what** was warned. So orgs, media, and policy makers can act on evidence instead of anecdote.

**Not a criticism platform.** Neutral tone. Data speaks.

## Mission at a glance

- **Aggregate** verified GLOF, flash flood, landslide, and infrastructure-damage events on an interactive GB map.
- **Surface** official PMD/PDMA/NDMA alerts alongside events.
- **Enable** low-friction sharing to amplify signal to ICIMOD, UNDP GLOF-II, AKAH, and international climate press.
- **Serve** on-ground GB residents (v2) via Telegram bot in Urdu.
- **Support** policy audiences (v3) with monthly PDF briefs.

Full mission, objectives, principles → [`idea.md`](idea.md).

## Tech stack

**Self-hosted** on a Hostinger VPS behind Nginx Proxy Manager + Cloudflare.

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (App Router, TypeScript, standalone build) |
| Map | MapLibre GL + OpenStreetMap |
| Database | Postgres 16 + PostGIS + `pgvector` (v2) |
| ORM | Drizzle |
| Auth | NextAuth.js (credentials + Drizzle adapter, bcrypt) |
| Cache / rate limit | Redis 7 |
| Scheduler | `worker/` container with `node-cron` |
| Deploy | `docker compose up -d` on VPS; NPM reverse-proxies, Cloudflare in front |
| Backups | Nightly `pg_dump` → Backblaze B2 / Cloudflare R2 |
| External APIs | Meta oEmbed (tokenless), Open-Meteo, Anthropic (v2 agent) |

## Repository layout

```
Climate Awareness/
├── README.md                # this file
├── idea.md                  # mission, objectives, audience, principles
├── plan.md                  # phased implementation plan with per-task status
├── docker-compose.yml       # postgres + redis + web + worker
├── .env.example             # required env vars (real .env lives on VPS)
├── db/
│   └── init/
│       └── 00-extensions.sql  # postgis + pgcrypto on first boot
├── research/
│   ├── gb-situation.md      # 2026 GB flood snapshot
│   └── data-sources.md      # endpoint feasibility matrix
├── web/                     # Next.js app (scaffolded in Phase 1.A)
└── worker/                  # cron worker (scaffolded in Phase 1.E)
```

## Roadmap

- **v1 (Weeks 1–4):** Map + verified feed + PMD/PDMA/NDMA alerts + weather overlay. English. International orgs + media + diaspora.
- **v2 (Weeks 5–10):** AI agent (RAG over ingested events) + Telegram bot + Urdu localization.
- **v3 (Weeks 11–16):** Monthly policy briefs (PDF), community submissions, formal outreach to ICIMOD / AKAH / UNDP.

Detailed phase breakdown → [`plan.md`](plan.md).

## Local development (once Phase 1 starts)

```bash
# Boot infra
docker compose up -d postgres redis

# Run web app
cd web
pnpm install
pnpm dev
```

## Deploy (on VPS)

```bash
cd /opt/climate-gb
git pull
docker compose build web worker
docker compose up -d
docker compose run --rm web pnpm db:migrate
```

Nginx Proxy Manager fronts the `web` container (port 3000, `127.0.0.1` only). Cloudflare fronts NPM.

## Verified source whitelist

Only these sources feed the map in v1. Additions require manual review.

- [Pamir Times](https://pamirtimes.net/) — GB regional news
- [Ibex Media Network](https://www.facebook.com/IbexMediaNetworkOfficial/) — GB video journalism
- Pakistan Meteorological Department (PMD) — GLOF advisories
- National Disaster Management Authority (NDMA) — national warnings
- Provincial Disaster Management Authority Gilgit-Baltistan (PDMA GB)
- Aga Khan Agency for Habitat (AKAH) — hazard maps (v3 partnership)
- [ICIMOD](https://www.icimod.org/) — HKH GLOF research + inventory
- UNDP GLOF-II Project Pakistan

## Editorial policy

- Every pin cites its source. No rehosted video.
- Meta oEmbed only for FB/IG/Threads. No scraping.
- No personal victim data without consent.
- Neutral framing: impact tracker, not failure tracker.
- Reject partisan submissions.

## Contributing

Not yet open to public contributions. Volunteer moderator roles open in Phase 3. If you represent one of the whitelisted orgs and want data partnership, reach out via issues once v1 is live.

## License

TBD. Likely AGPL-3.0 for code + CC-BY-4.0 for aggregated event data. Decision moved to Phase 1.G.

## Acknowledgements

Built by **Jawad Haider** — AI/ML engineer from Gilgit-Baltistan — because the crisis at home cannot wait.
