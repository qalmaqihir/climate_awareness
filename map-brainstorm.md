# Interactive Map Brainstorm

This document is the discovery record for the agreed product direction. The durable specifications are [`map_idea.md`](map_idea.md) and [`map_plan.md`](map_plan.md).

## Confirmed Starting Point

The map is not an empty feature: it has a rendering and filtering shell, but its entire seed dataset lacks coordinates. The first product work must therefore make incidents spatially trustworthy before adding richer interaction.

Current verified blockers:

- All 22 seeded incidents have no map point and are removed by the public GeoJSON endpoint.
- Twelve incidents use the unsupported `flash_flood` type while the user-facing filter expects `flood`.
- Social posts can be stored and displayed on the event detail page, but are not represented in the map experience.

## Initial Design Direction (not yet approved)

Build an evidence-first incident atlas with three tightly linked views:

1. Map: verified incident pins and clusters, with severity, type, date, and impact encoded clearly.
2. Timeline/feed: the same filtered events in chronological order, so low-precision locations remain useful.
3. Evidence drawer: selecting a pin opens a concise event card with source, verification, impact, and optional original Instagram/Facebook video embed.

A heatmap would be an opt-in analytical layer after coordinate coverage and precision metadata exist. It should show event concentration, not "impact", unless its metric and aggregation method are made explicit.

## Confirmed: Contributor Workflow

1. A trusted district contributor submits a private lead with evidence.
2. The submission remains invisible to all public endpoints and map layers.
3. A moderator checks source, date, location, event taxonomy, impact claims, media consent, and coordinate precision.
4. The moderator either publishes a verified incident, requests clarification, rejects it, or records it as disputed.
5. Publication creates the only record eligible for public-map rendering; the review decision remains auditable.

## Confirmed: Submission and Offline Intake

The contributor is asked for a short report, not a long form:

- What happened?
- When did it happen or begin?
- Where did it happen (place name, nearby landmark, or approximate location)?
- Who or what was affected?
- Is the impact continuing, and for how long?

Photo/video, source links, and an exact map point are optional supporting evidence. A moderator can extract useful location clues from media or source context, but must record the resulting confidence and precision before publication.

All report channels create the same conceptual lead. The initial system will support a web intake form and a moderator-entered lead for SMS, WhatsApp, voice notes, and calls. This avoids fragile integrations while ensuring every credible report follows the same review and publication rules.

## Confirmed: Flexible, Honest Location Model

The map must communicate uncertainty instead of excluding incomplete reports or inventing precision.

| Precision   | Public rendering                                         | Use when                                                            |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Exact       | Pin at the verified point                                | The coordinate is supported by evidence and safe to disclose.       |
| Approximate | Pin with a visible accuracy ring or “approximate” label  | The locality is known but the exact site is uncertain or sensitive. |
| District    | District-centroid/area marker labelled with the district | Only the district is known.                                         |
| Pending     | Feed-only, no map geometry                               | A credible report has no publishable location yet.                  |

The moderator chooses the precision level at publication and records a short location rationale. Later evidence can refine the same incident without losing its original report history.

## Confirmed: Incident Updates, Relations, and Merging

An incident is not a single immutable report. It is a public evidence record that can collect later updates.

- A contributor’s lead can be attached as an update when it describes the same continuing event.
- A nearby or connected occurrence can be marked as related when it is distinct but contextually useful.
- A moderator can merge duplicates to avoid a misleading pile of pins. The source and review history survives the merge.
- Separate events must remain separate when their time, hazard, or impact differs materially, even if they are nearby.

The map renders one public incident marker per incident, with an update count and “last updated” time. This communicates continuing impact without inflating apparent event numbers.

## Confirmed: Recent-First Public Experience

The initial map load prioritises immediate situational awareness:

- Load active incidents and a bounded recent time window first.
- Show a compact count, last-updated time, and a short feed before loading non-essential media.
- Allow users to browse historical events with date controls and search; do not download the full archive by default.
- Keep the selected filters in the URL so a low-bandwidth user can return to or share the same view.
