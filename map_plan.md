# Northern Pakistan Climate Watch — Map Implementation Plan

**Goal:** Deliver a trustworthy, low-bandwidth, evidence-first incident map that can grow from moderator-curated data to trusted contributor leads without redesigning the public map.

**Product specification:** [`map_idea.md`](map_idea.md)

**Whole-project plan:** [`plan.md`](plan.md). This document owns map-specific work only. Update it after every phase and record new evidence in `map_idea.md` before expanding scope.

## Delivery rules

- Implement and verify one phase at a time. Do not start a later phase merely because its schema is conceivable.
- Migrate data before relying on new rendering fields; never silently infer public precision.
- Add automated coverage for each public API rule and manual mobile/slow-network checks for each visible map phase.
- Preserve existing user changes outside map-owned files. Use reversible migrations and explicit data backfills.
- Do not publish a lead automatically. A moderator decision is required at every stage.

## Test tooling to establish in P0

| Layer       | Tooling target                                | Purpose                                                                        |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit        | Vitest                                        | Taxonomy, filter parsing, GeoJSON shaping, coordinate/precision validation.    |
| Integration | Vitest + isolated Postgres test database      | Queries, API handlers, visibility boundaries, migrations/backfills.            |
| Browser     | Playwright                                    | Map/filter/feed/drawer flows, URL state, mobile viewport, keyboard access.     |
| Manual      | Browser devtools and production-like database | Map rendering, 3G throttle, real source/embed behaviour, visual safety checks. |

No test suite should call a live social-media endpoint or modify production data.

---

## P0 — Correct, visible, recent-first public map

**Outcome:** Current verified incidents render accurately; visitors can discover recent impacts quickly on a low-bandwidth connection.

### P0.1 — Establish the public map contract

**Implementation**

- Define one canonical event taxonomy in `web/src/lib/schema.ts` and `web/src/lib/constants.ts`.
- Keep `flood` as the canonical type; add optional `eventSubtype` for `flash_flood` rather than treating it as a separate incompatible type.
- Add public fields needed by the map: `state` (`active`/`resolved`), `locationPrecision`, `locationRationale`, `lastUpdatedAt`, and a short safe summary if required.
- Keep `state` as a separate column from editorial `status`; `archived` is not a synonym for `resolved`.
- Decide whether fields extend the existing `events` table or are introduced through a clearly named compatibility migration. Preserve existing event IDs and URLs.
- Add strict shared validation schemas for admin writes and public filter parameters.
- Document the compact GeoJSON response and its maximum request limits.

**Automated tests**

- Event type/subtype values are accepted consistently by schema, form validation, seed parser, API, colours, and labels.
- Invalid combinations fail: exact location without coordinates; coordinates without precision; unsupported type/subtype; out-of-coverage coordinate; invalid date/range.
- Public GeoJSON properties conform to the contract and never contain full descriptions, private data, or raw embed HTML.

**Verification gate**

- Run typecheck, lint, unit tests, migration on an empty database, and migration on a copy of development data.
- Review generated migration SQL before applying it anywhere persistent.

### P0.2 — Repair and verify the seed dataset

**Implementation**

- Create a reviewed seed-location source file containing each event ID/title, source, coordinates or district representation, precision, rationale, and reviewer note.
- Backfill all 22 current seed events from that reviewed data. Use `exact` only for source-supported specific sites, `approximate` for named localities/valleys, and `district` for multi-valley/district-wide reports; do not invent an exact point from a district name.
- Normalize the 12 `flash_flood` seeds to `eventType: flood`, `eventSubtype: flash_flood`.
- Correct any known district inconsistencies (for example, a named Kharmang event must not silently render as Skardu if the source supports Kharmang).
- Mark events `pending` location only where no safe location is available and keep them in the feed but out of the point layer.

**Automated tests**

- Seed validation fails if an event lacks source URL, canonical type, reported date, or a valid precision/location combination.
- A fixture verifies the expected count of map-visible versus pending-location events.
- Every map-visible seed coordinate lies within the documented coverage envelope and is emitted in longitude/latitude order.

**Manual verification**

- Sample every seed against its cited source and record the reviewer decision.
- Inspect each map point at normal and close zoom; check that approximate/district labels do not imply exactness.

**Exit criterion:** `/api/events` returns non-empty valid GeoJSON for verified, map-visible seed incidents.

### P0.3 — Make filtering and recent loading real

**Implementation**

- Update `web/src/app/api/events/route.ts` and `web/src/lib/queries.ts` to apply type, district, date, active-state, bounded limit, and deterministic ordering server-side.
- Return `pending`-location published incidents to the compact recent feed, but exclude them from the GeoJSON point layer.
- Default requests to 30 days plus active incidents. Add a documented maximum historical range/result limit and cursor or pagination before large archives are enabled.
- Update `web/src/components/map/MapView.tsx` so filter state drives the API request, map layer, visible count, feed, and query string.
- Add loading, empty, invalid-filter, and service-error states that leave controls usable.
- Keep a small in-memory cache for the current filter state only; do not add a new global state framework.

**Automated tests**

- API tests cover every filter alone and intersections of type + district + range + active state.
- Default request includes recent events and active older events; archive results appear only after explicit date selection.
- Invalid filters return 400; empty valid filters return a valid empty FeatureCollection.
- Result limits, ordering, and cursor behaviour are deterministic.
- Browser tests prove that changing a type/district/date updates the URL, request, count, map source, and feed.

**Manual verification**

- Test on a mobile viewport at Slow 3G: default map must show usable UI and recent results before any evidence embed loads.
- Copy a filtered URL into a fresh browser session and confirm the same view.

### P0.4 — Improve map markers, clusters, and event cards

**Implementation**

- Retain MapLibre and the existing cluster source; add distinct rendering for exact, approximate, and district precision.
- Maintain type colour; use size/badge for severity and an explicit label for active state. Do not encode three meanings into one colour.
- Put an accessible, scrollable recent-results feed below the existing sidebar filters in P0. It uses the same API/filter state as the map and includes pending-location incidents; selecting a mapped item pans/opens its card, while a pending item opens the detail card without a map action.
- Replace the minimal popup with a compact drawer/card that links to `/events/[id]`, defers embeds, and exposes source/precision/update information.
- Ensure clusters are keyboard-operable through the feed and do not block event discovery.

**Automated tests**

- GeoJSON fixtures produce the expected marker metadata and cluster behaviour.
- Browser tests cover marker selection, cluster zoom/list behaviour, drawer close/open, feed selection, and detail navigation.
- Accessibility tests cover labelled controls, focus order, escape close, sufficient text alternatives, and no reliance on colour alone.

**Manual verification**

- Check desktop, small Android-sized viewport, Safari/iOS if available, and keyboard-only navigation.
- Check a dense fixture set so overlapping points and clusters remain understandable.

### P0 release gate

Run:

```bash
cd web
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Then perform the P0 manual checklist, deploy to a staging environment, verify `/api/events` response shape and map behaviour against staging data, and only then apply reviewed migrations/backfills to production.

**P0 is complete only when:** all intended seed events are truthfully represented, no private/unverified record is returned publicly, filters are URL-reproducible, and the recent-first mobile view works under a throttled connection.

---

## P1 — Private trusted-contributor leads and incident evolution

**Outcome:** Trusted contributors can submit concise private leads; a moderator can turn them into controlled public incidents and updates.

### P1.1 — Private lead and review data model

**Implementation**

- Add `leads` with private report fields, intake channel, contact/follow-up permission, submission state, and original location wording.
- Add `lead_evidence` for optional source URL, media reference, evidence type, privacy/consent state, and reviewer visibility decision.
- Add `incident_updates` and `incident_relations` so public incidents can evolve without duplicate pins.
- Add `review_decisions` (or equivalent immutable audit records) with reviewer, timestamp, action, rationale, and before/after public fields.
- Extend user access from admin-only to an explicit trusted-contributor capability. Do not grant public self-registration publishing rights.
- Use separate public and private query functions/endpoints; do not rely solely on client-side hiding.

**Automated tests**

- Database constraints reject invalid state transitions and unpublished evidence references on public records.
- A contributor can create/read only their permitted private lead scope; a moderator can review; anonymous users cannot access private endpoints.
- Guessing a lead/evidence ID through public routes returns not-found/forbidden and leaks no metadata.
- Audit entries are produced for publish, reject, merge, attach update, and location refinement.

**Verification gate**

- Threat-model review: enumerate every endpoint, response field, log, export, and cache path that could expose a private lead.
- Test the migration upgrade and downgrade strategy on non-production data.

### P1.2 — Moderator review workspace

**Implementation**

- Add a focused queue: submitted, needs clarification, under review, published, rejected, disputed, archived.
- Show the short report, optional evidence, source checks, location editor, precision selector, and privacy decision in one review screen.
- Support create-new-incident, attach-as-update, relate, and merge workflows with confirmation and rationale.
- Add active/resolved state and concise public update text; preserve original incident and lead history privately.
- Provide a moderator-created lead path for SMS, WhatsApp, voice notes, and calls.

**Automated tests**

- Browser tests cover every reviewer state transition and destructive/irreversible confirmation.
- Merge tests prove one public marker remains while source/update history remains accessible to a moderator.
- Publishing tests prove only approved fields appear in public detail/map responses.

**Manual verification**

- Run a tabletop review of five realistic cases: media-rich report, no-media report, location pending, duplicate report, and sensitive exact location.
- Confirm a moderator can use the workflow without direct SQL edits.

### P1.3 — Trusted contributor submission

**Implementation**

- Build a short mobile-first form with the six report prompts from `map_idea.md`.
- Make media/source/coordinates optional. Do not block a credible report without them.
- Validate field size, rate-limit authenticated submissions, acknowledge receipt without exposing review notes, and provide a safe contact path for clarification.
- Keep the request payload small. Add simple local draft only if it can be tested safely; do not build background offline sync in P1.

**Automated tests**

- Form validation accepts minimal valid report, rejects oversize/spam-shaped input, and handles optional evidence correctly.
- Browser test submits over a throttled network and confirms no draft/private data appears in public map/API responses.
- Authorization and rate-limit tests protect the route without blocking the moderator-entered intake path.

**Manual verification**

- Test with a real low-end mobile device or emulated network/viewport.
- Have one trusted user complete a test report and collect only actionable friction notes.

### P1.4 — Historical discovery and operating quality

**Implementation**

- Add archive mode with bounded date ranges/cursors and optional text search after P0 filtering is stable.
- Add public update histories and related-incident links.
- Add lightweight observability: API response size/time, map error count, lead state counts, and time to moderator decision. Avoid visitor surveillance.
- Write moderator runbook: verification rubric, severity guidance, sensitive-location policy, merge criteria, and data-correction process.

**Tests and verification**

- Archive paging/search must never bypass status or privacy filtering.
- Performance test fixtures confirm a large historical result set does not inflate initial map payload.
- Run a monthly sample audit: sources, precision labels, public/private boundary, and unresolved active incidents.

### P1 release gate

All P0 checks plus authorization/privacy integration suites, contributor/reviewer Playwright flows, a five-case moderator tabletop exercise, and a staging privacy review must pass.

**P1 is complete only when:** an approved contributor can submit a lead, a moderator can safely make a reviewed publication or update, and the public map reveals no private evidence or contributor details.

---

## P2 — Evidence-led extensions only after operating validation

**Outcome:** Add integrations and analytical layers only when P0/P1 data quality and moderation capacity justify them.

### P2.1 — Channel automation

- Evaluate WhatsApp/SMS ingestion against manual transcription time, privacy obligations, delivery reliability, and cost.
- If approved, route every automated message into the same `leads` state machine; never auto-publish.
- Consider voice transcription only as a private draft aid with mandatory human correction.

**Required tests:** signature/webhook validation, idempotency, replay protection, attachment privacy, failed-delivery recovery, and no automatic public output.

### P2.2 — Reported-event concentration layer

- Add only after a documented review shows sufficient coordinate coverage and no systematic district/source bias that would make it misleading.
- Let users choose date/type/district scope and show the exact count, precision distribution, and statement: “reported event concentration; not a forecast or impact map.”
- Keep incident pins as the default layer and make heatmap loading opt-in.

**Required tests:** correct aggregation under filters, clear legend/methodology, no default download, and visual checks that the layer cannot be mistaken for risk/impact.

### P2.3 — Future data layers

- Verified district boundaries, hazards, weather, roads, partner feeds, PWA features, and notifications may be considered one at a time.
- Each proposal must document source licence, update frequency, accuracy, privacy impact, rendering cost, failure mode, and a removal path.

---

## Cross-phase verification checklist

Before every release:

1. Inspect `git diff` and migration SQL; preserve unrelated work.
2. Run typecheck, lint, unit, integration, browser, and production build checks.
3. Seed a clean test database and test an upgrade from representative existing data.
4. Check all map API responses for private fields, unverified records, invalid GeoJSON, bad coordinate order, and unbounded queries.
5. Test default map load, each filter, zero state, error state, archive mode, drawer, detail link, and URL sharing.
6. Test keyboard, screen reader labels where available, mobile viewport, and slow/intermittent network behaviour.
7. Review at least one exact, approximate, district, and pending-location incident by hand.
8. Verify logging/analytics contain no contributor message body, exact private location, media URL, or contact information.
9. Deploy to staging first; confirm production database backup/restore readiness before migration.
10. Update `map_idea.md`, this plan, and the root `plan.md` with the delivered phase, evidence, and any changed decision.

## Known current blockers to resolve in P0

- All 22 existing seed events lack `location`, so the public API removes them before MapLibre receives them.
- Twelve seed events use `flash_flood`, while the current public type set expects `flood`.
- Map filters currently only send date values to the API; type and district must become server-side query parameters.
- Existing event detail pages can render sanitised Meta embeds, but the map has no controlled evidence-preview path.

## Change-control rule

New ideas are welcome, but they enter the plan only with a clear problem statement, user benefit, data source, privacy effect, test strategy, operating cost, and priority. If an item does not improve credible visibility of climate impact or reduce moderation burden, it stays out of the current phase.
