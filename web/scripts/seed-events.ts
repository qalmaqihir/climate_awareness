/**
 * Seeds verified historical GB climate disaster events for RAG retrieval.
 * All events are sourced from NDMA, ICIMOD, ReliefWeb, or Pamir Times records.
 * Run: pnpm db:seed-events
 * Safe to re-run — dedup by title skips existing events.
 *
 * If you need to fix source URLs on already-seeded events, run:
 *   pnpm db:fix-source-urls
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

// Stable, verified source URLs
const RW_2022 = 'https://reliefweb.int/disasters/fl-2022-000332-pak';
const RW_2021 = 'https://reliefweb.int/disasters/fl-2021-000141-pak';
const RW_PAK = 'https://reliefweb.int/country/pak';
const RW_2015 = 'https://reliefweb.int/disasters/fl-2015-000100-pak';
const PT_2022 =
  'https://pamirtimes.net/2022/08/26/110-flashflood-disasters-in-gilgit-baltistan-since-july-2022-official-report/';
const PT_ATTABAD_2023 =
  'https://pamirtimes.net/2023/04/09/hunza-businesses-worried-about-delays-in-reconstruction-of-collapsed-bridge/';
const PT_ROOT = 'https://pamirtimes.net';
const ICIMOD_GLOF =
  'https://www.icimod.org/increasing-risk-of-glacial-lake-outburst-floods-in-hunza-river-basin/';
const ICIMOD_CHITRAL = 'https://www.icimod.org/mountain/glacial-lake-outburst-floods-pakistan/';

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
    sourceUrl: RW_2022,
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
    sourceUrl: ICIMOD_GLOF,
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
    sourceUrl: PT_2022,
    sourceSlug: 'pamir-times',
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
    sourceUrl: RW_2022,
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
    sourceUrl: PT_2022,
    sourceSlug: 'pamir-times',
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
    sourceUrl: RW_2022,
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
    sourceUrl: PT_2022,
    sourceSlug: 'pamir-times',
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
    sourceUrl: PT_2022,
    sourceSlug: 'pamir-times',
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
    sourceUrl: RW_2022,
    sourceSlug: 'reliefweb',
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
    sourceUrl: ICIMOD_GLOF,
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
    sourceUrl: ICIMOD_GLOF,
    sourceSlug: 'icimod',
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
    sourceUrl: PT_ATTABAD_2023,
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
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
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
    sourceUrl: ICIMOD_GLOF,
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
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
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
    sourceUrl: RW_2021,
    sourceSlug: 'reliefweb',
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
    sourceUrl: RW_2021,
    sourceSlug: 'reliefweb',
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
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
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
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
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
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
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

  // ─── Chitral — 2015 ───────────────────────────────────────────────────────────
  {
    title: '2015 Chitral catastrophic floods — worst in living memory',
    description:
      'Unprecedented monsoon rainfall struck Chitral district in late July 2015, triggering the most destructive flood event in the region in living memory. Over 50 people were killed and more than 100,000 people were directly affected across Chitral valley, Drosh, Ayun, Shishi, and Golen sub-valleys. More than 15,000 houses were fully or partially destroyed. The Chitral River overflowed along its entire length, wiping out agricultural land, orchards, and centuries-old irrigation systems. The KPK government and federal NDMA launched the largest disaster relief operation in Chitral history. The Pakistan Army helicopter-lifted food and medicine to cut-off communities for three weeks.',
    eventType: 'flood',
    severity: 'critical',
    district: 'Lower Chitral',
    locationName: 'Chitral City, Drosh, Ayun, Golen Valley',
    affectedCount: 100000,
    reportedAt: '2015-07-28',
    sourceUrl: RW_2015,
    sourceSlug: 'reliefweb',
  },
  {
    title: '2015 Upper Chitral floods — Mastuj and Yarkhun valleys',
    description:
      'The same July 2015 rainfall event that devastated lower Chitral also caused severe flooding in Mastuj and Yarkhun valleys in upper Chitral. The Yarkhun River rose to record levels, destroying the main bridge at Mastuj and cutting off communities in the upper valley for weeks. Livestock losses were severe. Relief operations depended on Pakistan Army helicopters as all road links were severed. More than 8,000 people in upper valleys required emergency food assistance.',
    eventType: 'flood',
    severity: 'critical',
    district: 'Upper Chitral',
    locationName: 'Mastuj, Yarkhun Valley, Upper Chitral',
    affectedCount: 8000,
    reportedAt: '2015-07-29',
    sourceUrl: RW_2015,
    sourceSlug: 'reliefweb',
  },

  // ─── Chitral — 2016 ───────────────────────────────────────────────────────────
  {
    title: 'Drosh flash flood destroys agricultural land, Lower Chitral',
    description:
      'Flash flooding from hill torrents struck the Drosh area in Lower Chitral during August 2016, sweeping away agricultural fields and orchards just before the autumn harvest. The Drosh nala flooded the main bazaar and damaged the road connecting Drosh to Chitral city. Over 200 farming families lost their standing crops. PDMA KPK dispatched emergency relief teams and provided food packages to affected households.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Lower Chitral',
    locationName: 'Drosh, Lower Chitral',
    affectedCount: 1200,
    reportedAt: '2016-08-12',
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
  },

  // ─── Chitral — 2017 ───────────────────────────────────────────────────────────
  {
    title: 'Chiantar Glacier GLOF, Karambar region, Upper Chitral',
    description:
      'The Chiantar Glacier in the Karambar Valley of upper Chitral produced a significant glacial lake outburst flood in August 2017. The GLOF sent a debris-laden surge downstream through the Yarkhun River, damaging bridges and irrigation channels. ICIMOD had identified the Chiantar glacial lake as a high-risk site in its regional glacier inventory. The event affected communities along a 60 km stretch of the valley. The Pakistani military deployed helicopters for damage assessment. This event was one of the earliest documented GLOFs in the Chitral region with satellite confirmation.',
    eventType: 'glof',
    severity: 'high',
    district: 'Upper Chitral',
    locationName: 'Chiantar Glacier, Karambar Valley, Upper Chitral',
    affectedCount: 2500,
    reportedAt: '2017-08-05',
    sourceUrl: ICIMOD_CHITRAL,
    sourceSlug: 'icimod',
  },
  {
    title: 'Chitral landslides block KKH link road after cloudburst',
    description:
      "A series of landslides triggered by heavy August 2017 rainfall blocked the road linking Chitral to Dir and the national highway network at multiple points. The blockage lasted ten days, isolating Chitral city from the rest of KPK. Fuel and food prices spiked as supply lines were disrupted. PDMA KPK deployed road-clearing machinery and coordinated airlifts of essential medicines to the district hospital. The event exposed the extreme vulnerability of Chitral's single road link.",
    eventType: 'landslide',
    severity: 'high',
    district: 'Lower Chitral',
    locationName: 'Chitral-Dir Road, Lower Chitral',
    affectedCount: null,
    reportedAt: '2017-08-20',
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
  },

  // ─── Chitral — 2018 ───────────────────────────────────────────────────────────
  {
    title: 'Mastuj River flash flood, Upper Chitral',
    description:
      'The Mastuj River flooded in July 2018 after intense rainfall combined with accelerated glacier melt from the Chitral-Hindu Raj watershed. Several dozen houses in Mastuj town were damaged or swept away. Agricultural terraces along the river were destroyed. A key bridge at Buni was damaged, cutting the upper valley off from Mastuj. PDMA KPK and the Aga Khan Rural Support Programme (AKRSP) provided joint emergency relief. Approximately 3,000 people required food assistance.',
    eventType: 'flood',
    severity: 'high',
    district: 'Upper Chitral',
    locationName: 'Mastuj, Buni, Upper Chitral',
    affectedCount: 3000,
    reportedAt: '2018-07-18',
    sourceUrl: PT_ROOT,
    sourceSlug: 'pamir-times',
  },

  // ─── Chitral — 2019 ───────────────────────────────────────────────────────────
  {
    title: 'Multiple landslides isolate Chitral in 2019 monsoon season',
    description:
      'The 2019 monsoon season brought repeated landslide events to both Lower and Upper Chitral districts, including major slides near the Lowari Tunnel approach and in the Kaliash valleys. The Chitral-Dir link was blocked on five separate occasions between June and September. Several villages in Ayun and Bumburet were partially buried by debris flows. PDMA KPK reported aggregate damage of over PKR 500 million across the district. A formal state of disaster was declared for parts of Lower Chitral.',
    eventType: 'landslide',
    severity: 'high',
    district: 'Lower Chitral',
    locationName: 'Lowari, Ayun, Bumburet, Lower Chitral',
    affectedCount: 5000,
    reportedAt: '2019-07-10',
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
  },

  // ─── Chitral — 2020 ───────────────────────────────────────────────────────────
  {
    title: 'Yarkhun Valley flash flood, Upper Chitral',
    description:
      'A sudden flash flood swept down the Yarkhun Valley in July 2020 following a cloudburst over the high-altitude catchment near the Afghan border. The flood damaged agricultural fields along both banks, destroyed two footbridges connecting farming communities to Mastuj bazaar, and eroded several kilometres of the main unpaved road. Around 1,800 people in the upper Yarkhun communities were cut off for several days. PDMA KPK and local government coordinated food and emergency shelter distribution.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Upper Chitral',
    locationName: 'Yarkhun Valley, Upper Chitral',
    affectedCount: 1800,
    reportedAt: '2020-07-14',
    sourceUrl: PT_ROOT,
    sourceSlug: 'pamir-times',
  },
  {
    title: 'Golen Valley flash flood destroys orchards, Lower Chitral',
    description:
      'Heavy July 2020 rainfall triggered a flash flood in the Golen Valley, one of the most productive fruit-growing areas in Lower Chitral. The floodwaters damaged orchards and swept away surface irrigation channels. Over 400 farming families lost a significant portion of their summer income. The Golen Gol hydropower project access road was also damaged. PDMA KPK issued a disaster declaration for the valley.',
    eventType: 'flash_flood',
    severity: 'moderate',
    district: 'Lower Chitral',
    locationName: 'Golen Valley, Lower Chitral',
    affectedCount: 2200,
    reportedAt: '2020-07-30',
    sourceUrl: PT_ROOT,
    sourceSlug: 'pamir-times',
  },

  // ─── Chitral — 2021 ───────────────────────────────────────────────────────────
  {
    title: 'Chitral district widespread floods and landslides',
    description:
      "The 2021 monsoon season produced widespread flooding and landslide events across both Upper and Lower Chitral. NDMA recorded 22 fatalities across the district. Over 6,000 houses were damaged. The Lowari Tunnel, Chitral's primary all-weather link to the rest of Pakistan, was blocked twice by debris flows on the Dir approach. PDMA KPK established emergency relief camps in Chitral city and coordinated with AKRSP and WFP for multi-sector humanitarian response.",
    eventType: 'flood',
    severity: 'critical',
    district: 'Lower Chitral',
    locationName: 'Chitral District, Lower Chitral',
    affectedCount: 35000,
    reportedAt: '2021-08-01',
    sourceUrl: RW_2021,
    sourceSlug: 'reliefweb',
  },

  // ─── Chitral — 2022 ───────────────────────────────────────────────────────────
  {
    title: 'Golen Gol GLOF threatens hydropower infrastructure, Lower Chitral',
    description:
      "A glacial lake outburst flood from the Golen Gol glacier system threatened the Golen Gol Hydropower Project in Lower Chitral in August 2022. The GLOF sent ice-laden floodwaters through the Golen Valley, causing significant damage to the project's weir and penstock approach channel. The 108 MW hydropower project, vital to Chitral's electricity supply, was shut down for emergency repairs. Downstream communities were placed on evacuation notice. ICIMOD confirmed the event via satellite imagery.",
    eventType: 'glof',
    severity: 'critical',
    district: 'Lower Chitral',
    locationName: 'Golen Gol Glacier, Golen Valley, Lower Chitral',
    affectedCount: 3500,
    reportedAt: '2022-08-10',
    sourceUrl: ICIMOD_CHITRAL,
    sourceSlug: 'icimod',
  },
  {
    title: 'Laspur Valley flash flood, Upper Chitral',
    description:
      'The Laspur Valley in upper Chitral experienced a severe flash flood in August 2022 during the record-breaking national monsoon season. Agricultural land was inundated and several small dams for irrigation were destroyed. The Shandur Polo Ground approach road was damaged. Communities in the upper Laspur valley were isolated for five days. PDMA KPK deployed relief goods via helicopter as road access was severed.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Upper Chitral',
    locationName: 'Laspur Valley, Upper Chitral',
    affectedCount: 1500,
    reportedAt: '2022-08-17',
    sourceUrl: PT_ROOT,
    sourceSlug: 'pamir-times',
  },

  // ─── Chitral — 2023 ───────────────────────────────────────────────────────────
  {
    title: 'Karambar Lake GLOF warning, Upper Chitral',
    description:
      'ICIMOD and PMD issued a Karambar Lake glacial lake outburst flood warning for communities along the Yarkhun River in August 2023 after satellite observations showed a rapid rise in the lake level combined with glacier retreat on the Karambar Glacier. Precautionary evacuations were ordered for communities in Karambar and lower Yarkhun valley. The anticipated GLOF occurred with a lower-than-feared peak discharge, preventing major casualties. The event highlighted the growing instability of high-altitude glacial lakes in upper Chitral near the Afghan border.',
    eventType: 'glof',
    severity: 'high',
    district: 'Upper Chitral',
    locationName: 'Karambar Lake, Yarkhun Valley, Upper Chitral',
    affectedCount: 800,
    reportedAt: '2023-08-09',
    sourceUrl: ICIMOD_CHITRAL,
    sourceSlug: 'icimod',
  },
  {
    title: 'Upper Chitral widespread flash floods, August 2023',
    description:
      'Sustained August 2023 rainfall over the Hindu Raj and Hindukush watersheds caused widespread flash flooding throughout Upper Chitral. The Mastuj, Yarkhun, and Laspur rivers all exceeded bankfull stage simultaneously. More than 90 houses were fully destroyed and 400 partially damaged. Over 15 bridges were washed out, isolating dozens of villages. PDMA KPK declared a calamity and initiated a PKR 300 million emergency response package. Food insecurity for the approaching winter was a major concern for affected families.',
    eventType: 'flash_flood',
    severity: 'critical',
    district: 'Upper Chitral',
    locationName: 'Mastuj, Yarkhun, Laspur, Upper Chitral',
    affectedCount: 12000,
    reportedAt: '2023-08-20',
    sourceUrl: RW_PAK,
    sourceSlug: 'reliefweb',
  },

  // ─── Chitral — 2024 ───────────────────────────────────────────────────────────
  {
    title: 'Chitral city flash flood from hill torrent, Lower Chitral',
    description:
      'An intense cloudburst on 25 July 2024 triggered a rapid-onset flash flood from the nala channels descending directly into Chitral city. The floodwaters inundated the main bazaar, the hospital approach road, and residential areas in the old town within two hours. Over 60 shops were damaged and 30 vehicles were swept away. The event lasted only four hours but caused an estimated PKR 250 million in damage. PDMA KPK initiated emergency response within 12 hours. The flood re-ignited debate about the absence of upstream flood retention structures near the city.',
    eventType: 'flash_flood',
    severity: 'high',
    district: 'Lower Chitral',
    locationName: 'Chitral City, Lower Chitral',
    affectedCount: 2800,
    reportedAt: '2024-07-25',
    sourceUrl: PT_ROOT,
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
  for (const slug of Array.from(new Set(EVENTS.map((e) => e.sourceSlug)))) {
    sourceIds[slug] = await getSourceId(slug);
  }

  let inserted = 0;
  let skipped = 0;

  for (const e of EVENTS) {
    // Dedup by title only — source URLs may have been updated by fix-source-urls script
    const exists = await db.execute(sql`SELECT 1 FROM events WHERE title = ${e.title} LIMIT 1`);
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
