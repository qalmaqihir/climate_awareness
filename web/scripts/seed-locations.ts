/**
 * Reviewed seed-location source file — P0.2
 *
 * Each entry provides the approved public geometry, precision level, and
 * rationale for one of the 22 originally seeded events. This data was
 * reviewed against the event's cited source before being committed.
 *
 * Precision rules (per map_idea.md §5):
 *   exact       — source explicitly names and supports the specific public site
 *   approximate — named locality/valley is known; exact incident site is uncertain
 *   district    — event is explicitly multi-valley or district-wide
 *   pending     — no safe, truthful publishable location available yet
 *
 * All coordinates are WGS84 longitude/latitude and within the coverage envelope
 * (lat 34.5–37.5, lng 70.5–77.5). No coordinate is derived solely from a
 * district name.
 *
 * flash_flood eventType is normalized here to eventType: flood + eventSubtype:
 * flash_flood.  This is the canonical representation from P0.1 onwards.
 *
 * All historical events (no ongoing acute impact) are set to state: resolved.
 */

export interface SeedLocation {
  /** Exact title string matching the events table — used as the update key. */
  title: string;
  lat: number;
  lng: number;
  precision: 'exact' | 'approximate' | 'district';
  rationale: string;
  /** Overrides the seeded event_type when normalization is needed. */
  eventType?: string;
  /** Set only when event_type is normalized to flood (flash_flood subtype). */
  eventSubtype?: 'flash_flood';
  /** Correct the district field when the seed record contains an error. */
  districtOverride?: string;
  /** All historical events are resolved; only set explicitly active if still ongoing. */
  state: 'active' | 'resolved';
}

export const SEED_LOCATIONS: SeedLocation[] = [
  // ─── 2022 ────────────────────────────────────────────────────────────────────

  {
    title: 'Shishper Glacier GLOF destroys Hassanabad Bridge, Hunza',
    lat: 36.381,
    lng: 74.786,
    precision: 'approximate',
    rationale:
      'Hassanabad Bridge and village, KKH, Hunza. Coordinates represent the bridge/Hassanabad ' +
      'impact area per ICIMOD Hunza GLOF report (2022). Approximate: GLOF affected an extended ' +
      'corridor of the KKH rather than a single point.',
    state: 'resolved',
  },
  {
    title: 'Shishper Glacier second GLOF season surge, Hunza',
    lat: 36.37,
    lng: 74.74,
    precision: 'approximate',
    rationale:
      'Hassanabad-to-Aliabad corridor, Hunza Valley. Recurring GLOF from Shishper Glacier; ' +
      'point represents approximate midpoint of the affected stretch per ICIMOD monitoring record.',
    state: 'resolved',
  },
  {
    title: 'Gilgit city flash floods from multiple hill torrents',
    lat: 35.922,
    lng: 74.308,
    precision: 'approximate',
    rationale:
      'Gilgit city centre. Multiple simultaneous nalas (Jutial, Naltar, Danyore) affected; ' +
      'point represents the urban centre per PDMA GB emergency report Aug 2022.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Bagrote Valley catastrophic flash flood, Gilgit District',
    lat: 35.979,
    lng: 74.444,
    precision: 'approximate',
    rationale:
      'Bagrote Valley, Gilgit District. Valley-wide cloudburst event; approximate valley ' +
      'centre per ReliefWeb 2022 Pakistan flood record (fl-2022-000332-pak).',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Ghizer River major flood damages Phander and Ghakuch',
    lat: 36.169,
    lng: 73.775,
    precision: 'approximate',
    rationale:
      'Ghakuch, Ghizer district headquarters on the Ghizer River. Event covered the ' +
      'Phander-to-Ghakuch corridor; approximate district HQ location per NDMA report.',
    state: 'resolved',
  },
  {
    title: 'Diamer district multi-valley flash floods and road blockages',
    // Chilas, district HQ — representative point for district-level event
    lat: 35.424,
    lng: 74.104,
    precision: 'district',
    rationale:
      'Diamer district. Event simultaneously affected Chilas, Darel, Tangir, and Harban ' +
      'valleys; district-level representation appropriate per NDMA/ReliefWeb record. ' +
      'Point is Chilas (district HQ).',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Skardu flash flood damages Satpara Road infrastructure',
    lat: 35.302,
    lng: 75.545,
    precision: 'approximate',
    rationale:
      'Skardu city and Satpara Road corridor. NDMA report identifies Satpara nala and ' +
      'adjacent hill streams; approximate Skardu city centre.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Ghanche district cloud burst and flash flood',
    lat: 35.17,
    lng: 76.57,
    precision: 'approximate',
    rationale:
      'Khaplu Valley, Ghanche District. NDMA record identifies Khaplu Valley as the primary ' +
      'affected area; approximate valley location.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Astore River flash flood damages Astore town',
    lat: 35.371,
    lng: 74.717,
    precision: 'approximate',
    rationale:
      'Astore town bazaar and riverbank. ReliefWeb 2022 Pakistan flood record identifies ' +
      'Astore town as the affected area; approximate town centre.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Nagar Hoper Glacier GLOF, upper Nagar Valley',
    lat: 36.232,
    lng: 74.573,
    precision: 'approximate',
    rationale:
      'Hoper/Hopar Valley, Nagar. PMD GLOF early warning station confirmed at Hoper Glacier; ' +
      'approximate valley location per ICIMOD Hunza GLOF report.',
    state: 'resolved',
  },

  // ─── 2023 ────────────────────────────────────────────────────────────────────

  {
    title: 'Hoper Glacier GLOF causes infrastructure damage, Nagar',
    lat: 36.232,
    lng: 74.573,
    precision: 'approximate',
    rationale:
      'Hoper/Hopar Valley, Nagar. Recurring annual GLOF at same location as 2022 event; ' +
      'NDMA and ICIMOD monitoring teams deployed per ReliefWeb Pakistan record.',
    state: 'resolved',
  },
  {
    title: 'Hunza KKH landslide blocks highway near Attabad',
    lat: 36.336,
    lng: 74.863,
    precision: 'approximate',
    rationale:
      'Attabad Lake section of KKH, Hunza. Well-documented landmark; approximate location ' +
      'of 2023 landslide debris deposit on KKH per Pamir Times report (Apr 2023).',
    state: 'resolved',
  },
  {
    title: 'Skardu Shigar Valley flash flood, Shigar',
    lat: 35.415,
    lng: 75.723,
    precision: 'approximate',
    rationale:
      'Shigar town and Shigar River valley. ReliefWeb Pakistan record identifies Shigar ' +
      'Valley; approximate town/valley location.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Shishper Glacier GLOF season resumes, Hunza',
    lat: 36.381,
    lng: 74.786,
    precision: 'approximate',
    rationale:
      'Hassanabad, Hunza. Third consecutive year of Shishper GLOF events at Hassanabad ' +
      'Bridge approach; same approved geometry as 2022 events per ICIMOD monitoring.',
    state: 'resolved',
  },
  {
    title: 'Astore district flash floods, multiple villages',
    // Astore town — representative point for district-level multi-valley event
    lat: 35.371,
    lng: 74.717,
    precision: 'district',
    rationale:
      'Astore district. Event explicitly covered Astore, Gudai, and Minimerg sub-valleys; ' +
      'district-level representation appropriate per ReliefWeb Pakistan record. ' +
      'Point is Astore town (district HQ).',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },

  // ─── 2021 ────────────────────────────────────────────────────────────────────

  {
    title: 'Diamer district cloudburst and landslide cascade',
    // Chilas — representative point for multi-valley Diamer event
    lat: 35.424,
    lng: 74.104,
    precision: 'district',
    rationale:
      'Diamer district. Multi-valley landslide cascade in Darel and Tangir; district-level ' +
      'representation appropriate per ReliefWeb 2021 Pakistan flood record. ' +
      'Point is Chilas (district HQ).',
    state: 'resolved',
  },
  {
    title: 'Astore River bridges and road damaged in flash flood',
    lat: 35.371,
    lng: 74.717,
    precision: 'approximate',
    rationale:
      'Astore town bazaar and riverbank, 2021. Same approved geometry as 2022 Astore event; ' +
      'ReliefWeb 2021 Pakistan flood record identifies Astore town.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },

  // ─── 2024 ────────────────────────────────────────────────────────────────────

  {
    title: 'Passu Glacier GLOF threatens Gojal Valley, Upper Hunza',
    lat: 36.479,
    lng: 75.001,
    precision: 'approximate',
    rationale:
      'Passu village, Gojal Valley, upper Hunza. PMD GLOF early warning sensors at Passu ' +
      'Glacier confirmed event; approximate village location per ReliefWeb Pakistan record.',
    state: 'resolved',
  },
  {
    title: 'Kharmang Valley flash flood, multiple bridge failures',
    lat: 35.25,
    lng: 76.32,
    precision: 'approximate',
    rationale:
      'Kharmang Valley, Shyok River. ReliefWeb Pakistan record identifies Kharmang Valley ' +
      'as affected area. District corrected from Skardu to Kharmang (separate district). ' +
      'Approximate valley location.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    // The seed incorrectly assigned district: Skardu; Kharmang is its own district.
    districtOverride: 'Kharmang',
    state: 'resolved',
  },
  {
    title: 'Diamer flash flood destroys Chilas bazaar shops',
    lat: 35.424,
    lng: 74.104,
    precision: 'approximate',
    rationale:
      'Chilas city bazaar, Diamer District. Pamir Times report identifies Chilas bazaar ' +
      'and KKH bridge as flood impact area; approximate city centre.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Ghizer Valley flash floods damage Ishkoman road',
    lat: 36.288,
    lng: 73.561,
    precision: 'approximate',
    rationale:
      'Ishkoman Valley, Ghizer District. ReliefWeb Pakistan record identifies Ishkoman ' +
      'road as affected area; approximate valley location.',
    eventType: 'flood',
    eventSubtype: 'flash_flood',
    state: 'resolved',
  },
  {
    title: 'Astore Deosai landslide blocks road, hikers stranded',
    lat: 35.22,
    lng: 74.85,
    precision: 'approximate',
    rationale:
      'Astore-Deosai road. Pamir Times report places landslide on the high-altitude approach ' +
      'to Deosai plateau; approximate route midpoint between Astore town and the plateau.',
    state: 'resolved',
  },
];
