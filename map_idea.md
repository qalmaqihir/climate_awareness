# Northern Pakistan Climate Watch — Map Product Idea

**Purpose:** Define the long-term product direction for the public incident map and its private contributor workflow.

**Companion:** [`map_plan.md`](map_plan.md) for phased delivery and verification; [`idea.md`](idea.md) for the project mission; [`plan.md`](plan.md) for the whole-project roadmap.

**Status:** Approved direction for phased implementation. Update this document when real use or new evidence changes a decision.

---

## 1. Core outcome

The map must make a credible climate-impact event understandable in one minute:

1. **Where** did it happen, and how precise is that location?
2. **What** happened, **when**, and is it still active?
3. **Who or what** was affected, based on the evidence available?
4. **Why should the viewer trust it?** Show its verification status and source.
5. **What changed since the first report?** Show concise updates without inflating the event count.

The map is an evidence-first public record of climate impacts in Gilgit-Baltistan and Chitral. It is not a social-media feed, a live emergency-service dispatch system, or a technical demonstration.

### Primary audiences

- Residents and diaspora who need a fast picture of recent impacts on weak or intermittent connections.
- Journalists, civil-society groups, and international organisations who need a citeable, source-linked record.
- Trusted district contributors and moderators who need a safe path from local observation to verified publication.

### Product principles

- **Truth before visual density:** never imply a more precise location, impact number, or confidence level than the evidence supports.
- **Recent first:** load active incidents and a short recent window before the historical archive.
- **Evidence before virality:** media supports an incident; it does not become the product.
- **Private until approved:** no contributor lead, identity, media, or coordinates may reach public endpoints before moderator publication.
- **Low bandwidth is normal:** defer historical geometry, embeds, and heavy media; work well on a small mobile screen.
- **One simple data path:** web, SMS, WhatsApp, voice notes, and calls all become the same private lead record.
- **Human moderation is a feature:** trusted contributors improve coverage; a moderator protects accuracy and safety.

---

## 2. Chosen map approach

### Options considered

| Approach                          | Strength                                                                               | Limitation                                                                          | Decision                                          |
| --------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Evidence-first incident atlas** | Clear pins, dates, impacts, sources, and updates; works with sparse but credible data. | Requires careful location and review metadata.                                      | **Chosen as the default.**                        |
| Heatmap/dashboard first           | Quickly suggests regional concentration.                                               | With sparse or uneven reports, it can falsely imply hazard intensity or neglect.    | P2 analytical overlay only.                       |
| Social “stories on a map” first   | Makes individual evidence emotionally immediate.                                       | Heavy on bandwidth; can prioritise the most shareable media over the best evidence. | Evidence cards only; never the primary map model. |

### Default experience

The public route opens to the **last 30 days plus unresolved active incidents**. It requests a compact GeoJSON payload and a short event list, not every historical record.

The experience has three linked surfaces:

1. **Map** — verified incident pins, district/approximate representations, and clusters.
2. **Recent feed** — the same filtered incidents in reverse chronological order; useful when a map point is pending or a connection is poor.
3. **Event drawer/detail** — an accessible, concise record with source, verification, impact, update history, and optional original media.

Changing a filter changes all three surfaces and updates the URL. A shared URL reproduces the same view.

### What every public marker communicates

| Signal             | Encoding                                                           | Rule                                                                            |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Event type         | Colour and readable label                                          | Use the canonical type taxonomy. Never colour-code political meaning.           |
| Severity           | Marker size and text badge in the detail card                      | Severity is moderator-assigned and explained in editorial guidance.             |
| Active state       | Small `Active` label/badge                                         | Visible only while the moderator has not resolved the incident.                 |
| Location precision | Exact, approximate, or district icon/ring and plain-language label | Never use a normal precise pin for an approximate location.                     |
| Cluster            | Count bubble                                                       | Click/tap zooms or opens a compact list; it does not hide evidence permanently. |
| Updates            | “Updated N times · last updated …” in card/list                    | One public incident remains one marker.                                         |

Impact numbers are displayed as a sourced field in cards. They must not determine bubble size or a heatmap until coverage and definitions are consistent enough to support comparison.

---

## 3. Public interaction design

### Filters and navigation

- **Time:** default recent 30 days + active incidents; presets for 7 days, 90 days, this monsoon, and custom range.
- **Type:** GLOF, flood, landslide, infrastructure damage, casualty, displacement, and other. `Flash flood` is a flood subtype, not a competing canonical type.
- **District:** all project districts, including Upper and Lower Chitral.
- **Status:** active/resolved when there is enough data; do not expose private review states.
- **History:** explicit “Explore archive” action; paginated or date-bounded requests only.
- **Reset and result count:** always visible. A zero-result state explains how to broaden the view.

Filters must be server-side for type, district, date, and active state. The client may refine a loaded result set for immediate feedback, but the API is the source of truth.

### Event drawer and detail page

Selecting a marker or feed item opens a compact drawer/card with:

- event title, type, severity, current state, and reported/updated dates;
- location name, district, and exact/approximate/district precision label;
- concise verified summary and affected-count qualifier where known;
- original source link and verification label;
- update history and links to related incidents;
- optional evidence preview. The full Meta embed or external video loads only after the user asks to view it.

The full `/events/[id]` page remains the shareable, accessible record. The map drawer should link to it rather than duplicating a long report.

### Media policy

- Do not rehost contributor media in the initial release.
- Keep original source links and existing sanitised Meta embeds.
- Treat EXIF/GPS as a lead for moderator review, not automatic proof or automatic publication.
- Remove personal details, faces, vehicle plates, home locations, or other sensitive material from public display when safety or consent is unclear.
- A video/photo is optional; a credible short report without media can still be reviewed and published.

### Heatmap policy

A heatmap is **not** a P0/P1 default layer. In P2 it may display clearly labelled **reported-event concentration** only when filters, date range, coordinate precision, and the aggregation method are explicit. It must never be described as impact, risk, forecast, or affected-population density unless separate validated data supports that claim.

---

## 4. Trusted contributor and moderator workflow

### Intake channels

| Channel                             | P0/P1 treatment | Why                                                                                                   |
| ----------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| Moderator creates a lead            | P0              | Lets SMS, WhatsApp, voice notes, and calls enter the system immediately without brittle integrations. |
| Short web form                      | P1              | Gives trusted contributors a direct low-bandwidth path.                                               |
| WhatsApp/SMS automation             | P2              | Add only after the review workflow and message volume justify it.                                     |
| Voice/call transcription assistance | P2              | Keep human review; automate only if privacy and quality are proven.                                   |

### Short lead report

The contributor is asked for only the minimum useful facts:

1. What happened?
2. When did it happen or begin?
3. Where did it happen: place name, landmark, or approximate location?
4. Who or what was affected?
5. Is the impact continuing, and for how long?
6. Optional: photo/video, source link, contact follow-up, and estimated coordinates.

The form must save a draft locally only if it can do so safely and simply. A first release may favour a short submit-and-confirm flow over an offline synchronisation system.

### Review states

`draft` → `submitted` → `needs_clarification` → `under_review` → one of:

- `published` — creates or updates a verified public incident;
- `rejected` — remains private with a reason;
- `disputed` — remains private unless an editorial decision publishes a carefully worded record;
- `archived` — private record retained for audit.

Public APIs may return only `published` incidents. They must never reveal lead IDs, contributor identifiers, private notes, or private media URLs.

### Moderator checklist

Before publishing, record:

- source/evidence reviewed and why it is credible;
- event type and severity;
- reported time and whether it is an estimate;
- location, precision, safety rationale, and source of coordinate;
- affected people/infrastructure only if evidence supports the claim;
- media-consent/privacy decision;
- relationship to an existing incident: new, update, related, or merge;
- reviewer and decision timestamp.

### Incident lifecycle

An **incident** is the public record; a **lead** is a private input; an **update** is a verified change to an incident.

- Attach subsequent reports to the same incident when they describe its continued impact.
- Link distinct but contextually connected incidents as related.
- Merge duplicates only after considering time, hazard, location, and evidence—not proximity alone.
- Retain original leads, sources, and moderator decisions after a merge. The public map displays one marker and a concise update history.
- A moderator resolves an incident when the acute impact has ended or reliable follow-up establishes resolution. Historical records remain discoverable.

---

## 5. Honest location model

| Precision     | Public representation                                | When allowed                                         |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `exact`       | Precise point                                        | Supported by credible evidence and safe to disclose. |
| `approximate` | Point plus accuracy ring and label                   | Locality known, exact site uncertain or sensitive.   |
| `district`    | Clearly labelled district marker/area representation | District known but no reliable locality.             |
| `pending`     | Feed-only; no geometry                               | Credible incident has no publishable location yet.   |

The data model stores the original reported location separately from the approved public geometry. A moderator can refine location later without losing the report’s original wording or audit history.

### P0 coordinate decision

A named settlement, valley, or district is not automatically the exact event site. For the initial 22 seeds:

- use `exact` only when the cited record or a reviewed authoritative source supports the specific public site (for example, a named bridge or glacier outlet) and disclosure is safe;
- use `approximate` for a reviewed named locality/valley point when the event occurred somewhere in that locality;
- use `district` for genuinely multi-valley or district-wide reports;
- use `pending` only when even a truthful locality/district representation cannot yet be supported.

Every backfilled coordinate needs a source/rationale record and moderator review; no coordinate is generated merely from a district name.

---

## 6. Sustainable data contract

The frontend should render a stable, documented public incident shape. New volunteers and new sources should add data, not require map-code edits.

### Canonical public incident fields

| Field                                                | Required public meaning                                      |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `id`, `slug`                                         | Stable, shareable incident identity.                         |
| `title`, `summary`                                   | Short factual description.                                   |
| `eventType`, `eventSubtype`                          | Canonical broad type; optional detail such as `flash_flood`. |
| `severity`, `state`                                  | Moderator-assigned impact level and active/resolved state.   |
| `reportedAt`, `lastUpdatedAt`                        | Event time and latest verified update.                       |
| `district`, `locationName`                           | Human-readable context.                                      |
| `geometry`, `locationPrecision`, `locationRationale` | Approved public location and honest uncertainty.             |
| `affectedCount`, `impactNotes`                       | Optional, source-qualified impact statement.                 |
| `sourceCount`, `evidenceAvailable`                   | Evidence summary without exposing private lead data.         |
| `updateCount`, `relatedIncidentIds`                  | Lifecycle context.                                           |

### API rules

- Public endpoint returns compact GeoJSON with the fields needed for rendering, limited and paginated/cursored.
- The recent feed uses the same public incident filter contract but includes `pending`-location incidents. The map point layer excludes only `pending` geometry.
- Detail endpoint returns a single public incident and only approved public updates/evidence.
- Filter parameters are validated: `types`, `districts`, `from`, `to`, `active`, `cursor`, and bounded `limit`.
- Requests are bounded by date window and result count. Historical browsing loads more only after an explicit user action.
- The API always excludes private leads and non-published incidents, even if an ID is guessed.
- Preserve filter state in query parameters so links are reproducible and shareable.

### Data-quality rules

- One canonical event-type enum is used by seed data, moderator forms, API validation, and map labels.
- A source URL, media link, and exact coordinate are optional; location precision and source confidence are mandatory at publication.
- GeoJSON uses WGS84 longitude/latitude. All coordinates are range-checked against the Northern Pakistan coverage envelope before review and again before public output.
- Every seed and imported incident has a source record and an explicit location precision.
- No automatic scraping or metadata extraction may change a public geometry without a moderator decision.

---

## 7. Scope priorities

### P0 — Make the existing map truthful and useful

- Repair the current 22 seeded events: canonical types, reviewed coordinates/precision, sources, and public map output.
- Make filters, recent-first loading, clusters, marker states, popups/drawer, feed, and URL state work together.
- Add the minimum data contract and tests that prevent private or coordinate-less records from appearing incorrectly.
- Keep moderator-only incident creation working; no public submission form yet.
- Use a separate public lifecycle state (`active` or `resolved`) alongside editorial verification status (`verified`, `unverified`, `disputed`, `archived`).

### P1 — Make trusted contribution sustainable

- Add private leads, reviewer workflow, decision audit, incident updates/relations, and a trusted contributor web form.
- Add media/evidence references, privacy controls, location precision workflow, and public update histories.
- Add archive browsing, search, accessibility, performance telemetry, and operational documentation.

### P2 — Add only after P0/P1 use validates the need

- WhatsApp/SMS intake automation and voice-transcription assistance.
- Opt-in reported-event concentration layer, only with clear methodology and adequate coordinate coverage.
- District boundaries/hazard layers, offline/PWA features, notifications, richer analytics, and partner data imports.

### Explicitly out of scope for now

- Automatic public publishing by volunteers.
- Rehosting, downloading, or auto-playing social video.
- A live location tracker, risk forecast, or emergency-response dispatch system.
- Complex multi-role workflow engines, AI moderation, satellite analysis, or a full offline sync system.

---

## 8. Success measures and operating checks

### P0 success

- Every published seed incident intended for the map is visible with a truthful precision label.
- Every type, district, and date filter changes both map and feed consistently.
- The default mobile view shows useful recent incidents without downloading the archive or embeds.
- No non-verified record appears through the public map API.

### P1 success

- A trusted contributor can submit a short lead on a weak connection.
- A moderator can review, request clarification, publish, reject, attach, relate, or merge without database edits.
- A published incident exposes only approved evidence and never contributor identity/private notes.
- A real incident can receive an update without producing a duplicate public marker.

### Sustainability measures

- Median moderator time from submitted lead to first decision.
- Percentage of published incidents with a source and precision label.
- Percentage of public events with exact, approximate, district, and pending location.
- Duplicate/merge rate and number of unresolved active incidents.
- Mobile map response size and load time on a throttled connection.

---

## 9. Decisions to revisit from evidence

- Default recent window: start at 30 days; adjust using usage and monsoon-season review.
- Severity definitions: publish a small editorial rubric before multiple moderators are active.
- Which trusted contributors receive direct form access and how accounts are approved.
- Whether district representation should be a marker or verified district boundary after a reliable boundary dataset is selected.
- Whether any intake automation saves more moderation time than it adds in privacy, reliability, and operating cost.
