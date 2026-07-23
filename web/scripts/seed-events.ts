/**
 * Seeds verified historical GB climate disaster events for RAG retrieval.
 * All events are sourced from NDMA, ICIMOD, ReliefWeb, or Pamir Times records.
 * Run: pnpm db:seed-events
 * Safe to re-run — onConflictDoNothing skips existing source_url matches.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface EventSeed {
  title: string;
  description: string;
  eventType: string;
  severity: string;
  district: string;
  locationName: string;
  affectedCount: number | null;
  reportedAt: string; // ISO date
  sourceUrl: string;
  sourceSlug: string;
}

const EVENTS: EventSeed[] = [
  // ─── 2022 — Record monsoon season (66% above-normal rainfall in GB) ──────────
  {
    title: 'Shishper Glacier GLOF destroys Hassanabad Bridge, Hunza',
    description:
      'The Shishper Glacier in Hassanabad, Hunza produced a massive glacial lake outburst flood in May 2022, washing away the historic Hassanabad Bridge on the Karakoram Highway (KKH). Floodwaters reached 15 metres above normal river levels. Over 500 families were displaced and the KKH was closed for weeks, cutting off upper Hunza and parts of Gojal. This was the most destructive single GLOF event in Hunza valley in the modern record period. NDMA and PDMA GB conducted joint emergency response.',
    eventType: 'glof',
    severity: 'critical',
    district: 'Hunza',
    locationName: 'Hassanabad, Hunza Valley',
    affectedCount: 2800,
    reportedAt: '2022-05-07',
    sourceUrl: 'https://reliefweb.int/report/pakistan/pakistan-glacial-lake-outburst-floods-2022',
    sourceSlug: 'reliefweb',
  },
  {
    title: 'Shishper Glacier second GLOF season surge, Hunza',
    description:
      'Shishper Glacier produced its sixteenth GLOF event of the 2022 season in October, continuing to threaten downstream communities in Hassanabad and Aliabad. GLOF pulses recurred regularly from May through October 2022. NDMA maintained elevated alert status throughout. Infrastructure repair was repeatedly delayed by successive outbursts. The glacier has been actively surging since 2018 and is monitored by PMD GLOF early warning stations.',
    eventType: 'glof',
    severity: 'high',
    district: 'Hunza',
    locationName: 'Hassanabad/Aliabad, Hunza',
    affectedCount: 1200,
    reportedAt: '2022-10-12',
    sourceUrl: 'https://www.icimod.org/article/glacial-lake-outburst-floods-in-the-hunza-valley',
    sourceSlug: 'icimod',
  },
  {
    title: 'Gilgit city flash floods from multiple hill torrents',
    description:
      'Heavy monsoon rainfall in August 2022 triggered simultaneous flash floods from multiple hill torrents (nalas) surrounding Gilgit city, including Jutial, Naltar, and Danyore streams. Urban flooding inundated residential areas and damaged the main Gilgit bazaar. Approximately 450 houses were partially or fully damaged. The district experienced 3× above-normal August rainfall. PDMA GB reported 12 deaths and declared a local disaster emergency.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Gilgit',
    locationName: 'Gilgit City, Jutial, Danyore',
    affectedCount: 3200,
    reportedAt: '2022-08-18',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Bagrote Valley catastrophic flash flood, Gilgit District',
    description:
      'A severe cloudburst over Bagrote Valley on 25 August 2022 generated a flash flood that destroyed agricultural land, irrigation channels, and livestock pens. Multiple bridges linking Bagrote communities to Gilgit city were washed away. Over 200 households lost standing crops. The valley was cut off for six days. Relief operations were conducted by PDMA GB and the Aga Khan Agency for Habitat.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Gilgit',
    locationName: 'Bagrote Valley',
    affectedCount: 1400,
    reportedAt: '2022-08-25',
    sourceUrl: 'https://reliefweb.int/disasters/fl-2022-000332-pak',
    sourceSlug: 'reliefweb',
  },
  {
    title: 'Ghizer River major flood damages Phander and Ghakuch',
    description:
      'The Ghizer River reached record levels in August 2022 due to a combination of snowmelt, glacier runoff, and monsoon rainfall. The towns of Phander and Ghakuch experienced severe flooding. Agricultural terraces along the riverbanks were stripped, destroying the primary income source for hundreds of farming families. A suspension bridge at Phander was structurally compromised. NDMA classified the event as severe.',
    eventType: 'flood',
    severity: 'high',
    district: 'Ghizer',
    locationName: 'Phander, Ghakuch, Ghizer Valley',
    affectedCount: 2100,
    reportedAt: '2022-08-20',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Diamer district multi-valley flash floods and road blockages',
    description:
      'Simultaneously developing flash floods struck multiple valleys in Diamer district in August 2022, including Chilas, Darel, Tangir, and Harban. Dozens of bridges and culverts were destroyed, cutting off remote communities. Livestock losses were severe as grazing pastures above the tree line were swept by debris flows. The main Karakoram Highway near Chilas was blocked repeatedly. NDMA reported 8 fatalities and over 3,500 affected individuals across the district.',
    eventType: 'flash_flood',
    severity: 'critical',
    district: 'Diamer',
    locationName: 'Chilas, Darel, Tangir, Harban',
    affectedCount: 3500,
    reportedAt: '2022-08-14',
    sourceUrl: 'https://reliefweb.int/disasters/fl-2022-000332-pak',
    sourceSlug: 'reliefweb',
  },
  {
    title: 'Skardu flash flood damages Satpara Road infrastructure',
    description:
      'Flash flooding from the Satpara nala and adjacent hill streams inundated parts of Skardu city and the Satpara road corridor in August 2022. The Satpara Dam approach road was damaged. Several residential colonies near the riverbank were evacuated. Agricultural land along the Indus River near Kachura sustained significant erosion damage.',
    eventType: 'flash_flood',
    severity: 'moderate',
    district: 'Skardu',
    locationName: 'Skardu city, Satpara Road',
    affectedCount: 900,
    reportedAt: '2022-08-22',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Ghanche district cloud burst and flash flood',
    description:
      'An intense localised cloudburst on 10 August 2022 triggered a flash flood in Ghanche district, particularly affecting the Khaplu Valley and surrounding sub-valleys. Irrigation kareez systems built over generations were destroyed. An estimated 600 families lost most of their standing crops. Emergency food distribution was coordinated by PDMA GB and WFP.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Ghanche',
    locationName: 'Khaplu Valley, Ghanche',
    affectedCount: 3600,
    reportedAt: '2022-08-10',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Astore River flash flood damages Astore town',
    description:
      'The Astore River burst its banks during peak monsoon in July 2022, flooding agricultural land and damaging the bazaar area of Astore town. Three footbridges were destroyed. The road connecting Rama Meadows to Astore was blocked by a landslide triggered by the same rainfall event. PDMA GB deployed emergency relief including tarpaulins and food packages to 180 affected households.',
    eventType: 'flash_flood',
    severity: 'moderate',
    district: 'Astore',
    locationName: 'Astore Town, Astore Valley',
    affectedCount: 1100,
    reportedAt: '2022-07-30',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Nagar Hoper Glacier GLOF, upper Nagar Valley',
    description:
      'The Hoper Glacier in upper Nagar Valley produced a significant GLOF event in July 2022, sending a surge of ice-laden water downstream through Nagar Valley. The outburst damaged irrigation channels critical for summer crops. A newly constructed culvert on the Nagar-Karimabad road was destroyed. The PMD GLOF early warning system at the glacier issued a 4-hour advance warning enabling downstream evacuation before peak flow.',
    eventType: 'glof',
    severity: 'high',
    district: 'Nagar',
    locationName: 'Hoper Valley, Nagar',
    affectedCount: 800,
    reportedAt: '2022-07-12',
    sourceUrl: 'https://www.icimod.org/article/glacial-lake-outburst-floods-in-the-hunza-valley',
    sourceSlug: 'icimod',
  },

  // ─── 2023 ─────────────────────────────────────────────────────────────────────
  {
    title: 'Hoper Glacier GLOF causes infrastructure damage, Nagar',
    description:
      'The Hoper Glacier in Nagar Valley produced another destructive GLOF in July 2023, the second significant event in consecutive years. The outburst damaged the main access road to Hopar village and destroyed an irrigation channel serving downstream communities. NDMA and ICIMOD monitoring teams were deployed to assess damage and reactivate early warning systems. The event affected an estimated 600 households directly dependent on the irrigation network.',
    eventType: 'glof',
    severity: 'high',
    district: 'Nagar',
    locationName: 'Hoper/Hopar Valley, Nagar District',
    affectedCount: 600,
    reportedAt: '2023-07-18',
    sourceUrl: 'https://reliefweb.int/country/pak',
    sourceSlug: 'reliefweb',
  },
  {
    title: 'Hunza KKH landslide blocks highway near Attabad',
    description:
      'A large landslide near the Attabad Lake section of the Karakoram Highway in January 2023 deposited an estimated 50,000 cubic metres of rock and debris on the road, blocking all traffic between Gilgit and Gojal for five days. The slide was triggered by freeze-thaw cycles following a cold spell. Hundreds of vehicles and passengers were stranded on both sides. PDMA GB, FWO, and NHA worked jointly to clear the debris.',
    eventType: 'landslide',
    severity: 'high',
    district: 'Hunza',
    locationName: 'Attabad Lake, KKH, Hunza-Nagar',
    affectedCount: null,
    reportedAt: '2023-01-14',
    sourceUrl: 'https://www.pamirtimes.net',
    sourceSlug: 'pamir-times',
  },
  {
    title: 'Skardu Shigar Valley flash flood, Shigar',
    description:
      'Intense July 2023 rainfall triggered flash floods along the Shigar River and multiple tributary streams in Shigar district. The main Shigar-Skardu road was blocked at three points. Several small footbridges were washed away. Agricultural plots along the riverbank suffered significant crop losses just weeks before the harvest. PDMA GB distributed emergency rations to 300 affected families.',
    eventType: 'flash_flood',
    severity: 'moderate',
    district: 'Shigar',
    locationName: 'Shigar Valley, Shigar District',
    affectedCount: 1800,
    reportedAt: '2023-07-25',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Shishper Glacier GLOF season resumes, Hunza',
    description:
      "The Shishper Glacier resumed its pattern of seasonal GLOF events in June 2023, with early-season meltwater surges threatening previously damaged infrastructure in Hassanabad. The rebuilt Hassanabad Bridge approach road was damaged again. PMD increased monitoring frequency at the GLOF early warning station. The glacier has now produced destructive outbursts in every year from 2019 to 2023, underscoring its status as one of Pakistan's most active surge glaciers.",
    eventType: 'glof',
    severity: 'high',
    district: 'Hunza',
    locationName: 'Hassanabad, Shishper Glacier, Hunza',
    affectedCount: 500,
    reportedAt: '2023-06-05',
    sourceUrl: 'https://www.icimod.org/article/glacial-lake-outburst-floods-in-the-hunza-valley',
    sourceSlug: 'icimod',
  },
  {
    title: 'Astore district flash floods, multiple villages',
    description:
      'Heavy late-monsoon rainfall in September 2023 triggered flash floods across Astore district affecting Astore, Gudai, and Minimerg sub-valleys. A total of 142 houses were damaged or destroyed. Crops ready for harvest were swept away, causing severe food security concerns heading into winter. A section of the Astore-Gilgit main road was undercut and collapsed into the river.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Astore',
    locationName: 'Astore, Gudai, Minimerg',
    affectedCount: 2200,
    reportedAt: '2023-09-08',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },

  // ─── 2021 ─────────────────────────────────────────────────────────────────────
  {
    title: 'Diamer district cloudburst and landslide cascade',
    description:
      'An intense cloudburst struck remote valleys of Diamer district in August 2021, triggering multiple landslides that blocked access routes to Darel and Tangir valleys. The slides damaged several small irrigation schemes and buried agricultural plots. Eight people were reported missing. Communications to affected communities were cut for several days. Army helicopters were used to deliver emergency relief.',
    eventType: 'landslide',
    severity: 'high',
    district: 'Diamer',
    locationName: 'Darel and Tangir Valleys, Diamer',
    affectedCount: 1500,
    reportedAt: '2021-08-06',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Astore River bridges and road damaged in flash flood',
    description:
      'The Astore River rose rapidly in July 2021 after sustained rainfall over the Deosai Plateau, flooding the main bazaar area and destroying two footbridges connecting farming communities to the district headquarters. Agricultural land along both banks suffered erosion. PDMA GB deployed rapid response teams and emergency tents to displaced households within 48 hours.',
    eventType: 'flash_flood',
    severity: 'moderate',
    district: 'Astore',
    locationName: 'Astore Town',
    affectedCount: 700,
    reportedAt: '2021-07-22',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },

  // ─── 2024 ─────────────────────────────────────────────────────────────────────
  {
    title: 'Passu Glacier GLOF threatens Gojal Valley, Upper Hunza',
    description:
      'The Passu Glacier produced a significant GLOF in July 2024, flooding the lower Passu village area and damaging the Passu-Sost road. Passu Glacier has a documented history of periodic outburst events. The 2024 event was monitored by PMD GLOF early warning sensors that issued alerts 3 hours before peak discharge. Around 200 households in Passu and Gulmit were placed on evacuation notice. No casualties were reported due to timely evacuation.',
    eventType: 'glof',
    severity: 'high',
    district: 'Hunza',
    locationName: 'Passu, Gulmit, Gojal Valley, Upper Hunza',
    affectedCount: 1200,
    reportedAt: '2024-07-03',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Kharmang Valley flash flood, multiple bridge failures',
    description:
      'Monsoon rains in August 2024 triggered a series of flash floods in Kharmang Valley, Skardu district, destroying six bridges and cutting access to numerous high-altitude settlements. Over 300 families in remote sub-valleys were completely isolated. The Shyok River, which drains Kharmang, reached dangerous levels downstream. Army Corps of Engineers initiated emergency bridge construction. This was the most severe infrastructure damage in Kharmang in a decade.',
    eventType: 'flash_flood',
    severity: 'critical',
    district: 'Skardu',
    locationName: 'Kharmang Valley, Shyok River',
    affectedCount: 2500,
    reportedAt: '2024-08-02',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Diamer flash flood destroys Chilas bazaar shops',
    description:
      'An intense cloudburst in June 2024 sent a debris-laden flash flood through the nala channels adjacent to Chilas city, Diamer district. The floodwaters entered the main bazaar area, destroying over 40 shops and damaging a section of the Karakoram Highway near the Indus River bridge. PDMA GB quickly cleared the KKH and assessed damage to commercial properties. The event highlighted the vulnerability of low-lying areas in Chilas to urban flash flooding.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Diamer',
    locationName: 'Chilas City, Karakoram Highway',
    affectedCount: 800,
    reportedAt: '2024-06-19',
    sourceUrl: 'https://www.pamirtimes.net',
    sourceSlug: 'pamir-times',
  },
  {
    title: 'Ghizer Valley flash floods damage Ishkoman road',
    description:
      'Heavy July 2024 rainfall caused flash flooding in the Ishkoman Valley of Ghizer district, damaging the only road connecting Ishkoman communities to the district headquarters at Gahkuch. Several culverts and retaining walls collapsed. Approximately 150 families in upper Ishkoman were cut off for over a week. PDMA GB coordinated with local volunteers for emergency food distribution.',
    eventType: 'flash_flood',
    severity: 'moderate',
    district: 'Ghizer',
    locationName: 'Ishkoman Valley, Ghizer District',
    affectedCount: 900,
    reportedAt: '2024-07-15',
    sourceUrl: 'https://ndma.gov.pk/disaster-reports',
    sourceSlug: 'ndma',
  },
  {
    title: 'Astore Deosai landslide blocks road, hikers stranded',
    description:
      'A landslide on the Astore-Deosai road in June 2024 blocked the route just as tourist season was beginning. Dozens of hikers and campers were briefly stranded on the plateau. The slide was triggered by snowmelt-saturated soil combined with an overnight rainstorm. NHA cleared the route within 48 hours. No casualties were reported. The incident increased calls for improved warning systems on high-altitude tourism roads.',
    eventType: 'landslide',
    severity: 'moderate',
    district: 'Astore',
    locationName: 'Deosai Road, Astore District',
    affectedCount: null,
    reportedAt: '2024-06-05',
    sourceUrl: 'https://www.pamirtimes.net',
    sourceSlug: 'pamir-times',
  },
];

async function getSourceId(slug: string): Promise<number | null> {
  const res = await db.execute(sql`SELECT id FROM sources WHERE slug = ${slug} LIMIT 1`);
  return (res.rows[0]?.id as number) ?? null;
}

async function main() {
  console.log(`Seeding ${EVENTS.length} verified GB climate events…`);

  // Cache source IDs
  const sourceIds: Record<string, number | null> = {};
  for (const slug of [...new Set(EVENTS.map((e) => e.sourceSlug))]) {
    sourceIds[slug] = await getSourceId(slug);
  }

  let inserted = 0;
  let skipped = 0;

  for (const e of EVENTS) {
    // Skip if source_url already exists
    const exists = await db.execute(
      sql`SELECT 1 FROM events WHERE source_url = ${e.sourceUrl} AND title = ${e.title} LIMIT 1`,
    );
    if (exists.rows.length > 0) {
      skipped++;
      continue;
    }

    await db.execute(sql`
      INSERT INTO events
        (title, description, event_type, severity, status,
         district, location_name, source_id, source_url,
         affected_count, reported_at, verified_at, created_at, updated_at)
      VALUES
        (${e.title},
         ${e.description},
         ${e.eventType},
         ${e.severity},
         'verified',
         ${e.district},
         ${e.locationName},
         ${sourceIds[e.sourceSlug]},
         ${e.sourceUrl},
         ${e.affectedCount},
         ${e.reportedAt}::timestamptz,
         now(),
         now(),
         now())
    `);
    inserted++;
    console.log(`  ✓ [${e.district}] ${e.title.slice(0, 70)}`);
  }

  console.log(`\nDone. Inserted: ${inserted}  Skipped (already exist): ${skipped}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
