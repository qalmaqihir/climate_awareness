# Data Sources — Feasibility & Access

**Compiled:** 2026-07-22
**Purpose:** Confirm each MVP data source is accessible + legal + free-tier viable.

## Summary table

| Source | Purpose | Access | Cost | v1 status |
|--------|---------|--------|------|-----------|
| Meta oEmbed (FB/IG/Threads) | Social post embeds | Public HTTP, **no token as of June 2026** | Free | ✅ Ready |
| Open-Meteo | Weather forecast + history | Public HTTP, no key | Free (10k calls/day, non-commercial) | ✅ Ready |
| PDMA GB | Provincial alerts | Website scrape (no public API found) | Free | ⚠️ Needs custom scraper |
| NDMA / NEOC | National advisories | Website (no public API found) | Free | ⚠️ Needs custom scraper |
| PMD (Pakistan Met Dept) | GLOF + weather advisories | Website + press releases | Free | ⚠️ Needs custom scraper |
| ICIMOD RDS (rds.icimod.org) | Glacier + glacial lake inventory | Web portal, download endpoints | Free (research use) | 🟨 Manual download → static layer |
| AKAH hazard maps | 828-village risk assessments | Not public; org outreach | Free (partnership) | ⏭️ Phase 3 (needs relationship) |
| Pamir Times | GB news feed | Website + WordPress → likely RSS at `/feed` | Free | 🟨 Test RSS in Phase 1 |
| Ibex Media Network | GB video journalism | FB/IG public pages | Free (via oEmbed) | ✅ Ready |
| OpenStreetMap | Base map tiles | Public tile server | Free (attribution required) | ✅ Ready |
| Sentinel Hub | Satellite imagery | Free tier, sign-up | Free (limited) | ⏭️ Phase 3 |

## Meta oEmbed — critical update (2026-07-22)

**Big win.** Per Meta's June 15, 2026 policy reversal:
- Facebook + Instagram + Threads oEmbed endpoints work **without access token**.
- **No App Review required.**
- **No developer account required.**
- Endpoints return same JSON: `html`, `provider_name`, `width`, `type`.
- Token-based route still exists with higher rate limits if needed later.

**Endpoints:**
- Facebook post: `https://graph.facebook.com/v20.0/oembed_post?url={POST_URL}`
- Facebook video: `https://graph.facebook.com/v20.0/oembed_video?url={VIDEO_URL}`
- Instagram: `https://graph.facebook.com/v20.0/instagram_oembed?url={POST_URL}`

**Impact on plan.md:**
- Task 1.D.1 (register Meta app) becomes optional — do only if rate-limited.
- Task 1.D.3 (oEmbed fetch) simplified — no auth headers.
- Faster path to launch.

**Risk:** Meta could reverse again. Keep abstraction layer around embed fetch so we can add token/cache fallback fast.

## Open-Meteo

- Base URL: `https://api.open-meteo.com/v1/forecast`
- Params: `latitude`, `longitude`, `hourly` or `daily` variables, `timezone`
- Historical: `https://archive-api.open-meteo.com/v1/archive` (weather-at-time for events)
- Rate limit: 10,000 calls/day free tier. Non-commercial only.
- **Verdict:** Legal fit — this project is non-commercial awareness, not paid product. If we ever monetize, upgrade to commercial plan (starts ~€29/mo).

## PDMA GB + NDMA + PMD

No documented public APIs. Options:
1. **Cheerio/Playwright scrape** of alert pages. Fragile but functional.
2. **RSS feed** if provided (need to check each site).
3. **Manual admin entry** for high-signal alerts as fallback.

**v1 plan:** Start with manual entry via admin. Build scraper opportunistically for the top-1 source (likely PDMA GB advisory page). Don't block launch.

**Sites to inspect:**
- PDMA GB — search "gbdma.gov.pk" or "pdma.gilgitbaltistan.gov.pk"
- NDMA — ndma.gov.pk
- PMD — pmd.gov.pk

## ICIMOD Regional Database System

- Portal: https://rds.icimod.org/
- 25,000+ glacial lakes mapped in HKH; 52 declared potentially dangerous for Pakistan.
- 2018 report + 2005 inventory publicly referenced.
- **Access:** portal downloads (shapefiles / CSV). No documented free API.
- **v1 approach:** Download once → convert to GeoJSON → serve as static map overlay layer.
- Also useful: comprehensive HMA GLOF database at [ESSD, 2023](https://essd.copernicus.org/articles/15/3941/2023/) — version-controlled inventory with occurrence times + downstream impacts. Perfect for historical archive layer.

## AKAH

- 828 villages hazard-mapped in GB + Chitral.
- 785 HVRAs conducted.
- 50 extremely hazard-prone settlements identified for relocation.
- **Not public.** Requires formal partnership.
- **Plan:** Not v1. Include in Phase 3 outreach (`plan.md` 3.C).

## Pamir Times RSS

- Likely WordPress → default feed URL `https://pamirtimes.net/feed/` or category feed.
- **Test in Phase 1.B or 1.E** with `curl`. If RSS live: parse in cron, surface latest headlines as sidebar.
- Not a substitute for verified event pins — headline ≠ geo-tagged event. Use for editorial context only.

## Decisions locked

1. Use tokenless Meta oEmbed. No app registration in v1.
2. Use Open-Meteo direct. No key.
3. Admin manual entry for alerts in v1. Scraper deferred to v1.E if time allows.
4. ICIMOD glacial lake layer = static GeoJSON, downloaded once, refreshed monthly.
5. AKAH data → v3 partnership outreach.

## Sources

- [Open-Meteo pricing](https://open-meteo.com/en/pricing)
- [Open-Meteo terms](https://open-meteo.com/en/terms)
- [Meta oEmbed Read Explained — Bluehost](https://www.bluehost.com/blog/meta-oembed-read-explained/)
- [Meta Quietly Undid the Change That Broke Instagram Embeds — WPMayor](https://wpmayor.com/meta-tokenless-oembed-wordpress/)
- [Instagram oEmbed docs — Meta for Developers](https://developers.facebook.com/docs/instagram-platform/oembed/)
- [ICIMOD Regional Database System](https://rds.icimod.org/)
- [Comprehensive HMA GLOF database — ESSD 2023](https://essd.copernicus.org/articles/15/3941/2023/)
- [ICIMOD GLOF page](https://www.icimod.org/mountain/glacial-lake-outburst-flood/)
- [AKAH-GB partnership announcement — AKDN](https://the.akdn/en/resources-media/whats-new/news-release/aga-khan-agency-habitat-and-government-gilgit-baltistan-partner-combat-climate-change)
- [AKAH hazard mapping methodology — World Habitat](https://world-habitat.org/world-habitat-awards/winners-and-finalists/integrating-indigenous-knowledge-and-technology-for-safer-habitat/)
