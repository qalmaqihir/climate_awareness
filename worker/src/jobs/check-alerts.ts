/**
 * Fetches GB-relevant alerts from three sources:
 *   1. ReliefWeb API — UN OCHA platform, aggregates Pakistan NDMA/PMD/PDMA reports (free JSON API)
 *   2. Pamir Times RSS — leading English-language GB newspaper, real-time disaster coverage
 *   3. GDACS RSS — UN global disaster alert system, Pakistan-filtered
 *
 * PMD removed: Cloudflare-blocked as of 2026.
 * NDMA /public/situation-reports: 404 — covered via ReliefWeb instead.
 * PDMA pdma.gob.pk: Balochistan province, not GB — removed.
 *
 * Deduplication: skip if source_url already exists in alerts table.
 * Runs every hour via cron in index.ts.
 */
import * as cheerio from 'cheerio';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';

const RELIEFWEB_URL = 'https://api.reliefweb.int/v1/reports';
const PAMIR_TIMES_RSS = 'https://www.pamirtimes.net/feed/';
const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';

const UA = 'NP-Climate-Watch/1.0 (+https://climate-awareness-gbc.qalmaq.cloud)';

const GB_KEYWORDS = [
  // Gilgit-Baltistan
  'gilgit',
  'baltistan',
  'glof',
  'skardu',
  'hunza',
  'ghizer',
  'diamer',
  'astore',
  'nagar',
  'ishkoman',
  'yasin',
  'shigar',
  'ghanche',
  'kharmang',
  'karakoram',
  'pamir',
  // Chitral (KPK)
  'chitral',
  'yarkhun',
  'mastuj',
  'golen',
  'chiantar',
  'karambar',
  'lowari',
  'drosh',
  'khowar',
];

function isGbRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return GB_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPakistanRelevant(text: string): boolean {
  return text.toLowerCase().includes('pakistan') || isGbRelevant(text);
}

function inferLevel(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('emergency') || lower.includes('red alert') || lower.includes('catastrophic'))
    return 'emergency';
  if (lower.includes('warning') || lower.includes('orange') || lower.includes('glof'))
    return 'warning';
  if (lower.includes('watch') || lower.includes('yellow')) return 'watch';
  return 'advisory';
}

function inferAlertType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('glof') || lower.includes('glacial lake')) return 'glof';
  if (lower.includes('flood')) return 'flood';
  if (lower.includes('landslide') || lower.includes('mudslide')) return 'landslide';
  if (lower.includes('earthquake') || lower.includes('seismic')) return 'general';
  if (lower.includes('weather') || lower.includes('rain') || lower.includes('monsoon'))
    return 'weather';
  return 'general';
}

async function getSourceId(slug: string): Promise<number | null> {
  const res = await db.execute(sql`SELECT id FROM sources WHERE slug = ${slug} LIMIT 1`);
  return (res.rows[0]?.id as number) ?? null;
}

async function getExistingUrlSet(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const res = await db.execute(
    sql`SELECT source_url FROM alerts WHERE source_url = ANY(${urls}::text[])`,
  );
  return new Set(res.rows.map((r) => r.source_url as string));
}

async function insertAlert(params: {
  title: string;
  body: string;
  alertType: string;
  level: string;
  district: string | null;
  sourceId: number | null;
  sourceUrl: string | null;
  issuedAt: Date;
}) {
  await db.execute(sql`
    INSERT INTO alerts
      (title, body, alert_type, level, district, source_id, source_url, is_active, issued_at)
    VALUES
      (${params.title.slice(0, 500)},
       ${params.body.slice(0, 3000)},
       ${params.alertType},
       ${params.level},
       ${params.district},
       ${params.sourceId},
       ${params.sourceUrl},
       true,
       ${params.issuedAt.toISOString()})
  `);
}

// ─── ReliefWeb API ────────────────────────────────────────────────────────────

async function scrapeReliefWeb(sourceId: number | null) {
  console.log('[alerts] Fetching ReliefWeb Pakistan disaster reports');

  const body = JSON.stringify({
    filter: {
      operator: 'AND',
      conditions: [
        { field: 'country.iso3', value: 'PAK' },
        {
          operator: 'OR',
          conditions: [
            { field: 'theme.name', value: 'Floods' },
            { field: 'theme.name', value: 'Natural Disasters' },
          ],
        },
      ],
    },
    sort: ['date.created:desc'],
    limit: 30,
    fields: { include: ['title', 'body', 'date', 'source', 'url'] },
  });

  const res = await fetch(`${RELIEFWEB_URL}?appname=climate-awareness-gb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`[alerts] ReliefWeb HTTP ${res.status}`);
    return;
  }

  const json = (await res.json()) as { data?: Array<{ fields: Record<string, unknown> }> };
  const items = json.data ?? [];

  const candidateUrls = items.map((i) => String(i.fields.url ?? '').trim()).filter(Boolean);
  const existingUrls = await getExistingUrlSet(candidateUrls);

  let inserted = 0;
  for (const item of items) {
    const f = item.fields;
    const title = String(f.title ?? '').trim();
    const body = String(f.body ?? title).trim();
    const url = String(f.url ?? '').trim();
    const dateStr = (f.date as { created?: string } | undefined)?.created;
    const issuedAt = dateStr ? new Date(dateStr) : new Date();

    if (!title || !isGbRelevant(title + ' ' + body)) continue;
    if (url && existingUrls.has(url)) continue;

    const combined = title + ' ' + body;
    await insertAlert({
      title,
      body: body || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceId,
      sourceUrl: url || null,
      issuedAt,
    });
    inserted++;
  }

  console.log(`[alerts] ReliefWeb: ${inserted} new GB-relevant reports inserted`);
}

// ─── Pamir Times RSS ──────────────────────────────────────────────────────────
// Leading English-language newspaper for Gilgit-Baltistan. Standard WordPress RSS.

async function scrapePamirTimes(sourceId: number | null) {
  console.log('[alerts] Fetching Pamir Times RSS');

  const res = await fetch(PAMIR_TIMES_RSS, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`[alerts] Pamir Times RSS HTTP ${res.status}`);
    return;
  }

  const xml = await res.text();
  const $ = cheerio.load(xml, { xml: true });
  const items = $('item').toArray();

  // Only ingest disaster-relevant articles — skip unrelated news
  const DISASTER_KEYWORDS = [
    'flood',
    'glof',
    'glacial',
    'landslide',
    'mudslide',
    'monsoon',
    'emergency',
    'disaster',
    'rainfall',
    'cloudburst',
    'road blocked',
    'bridge',
    'casualties',
    'ndma',
    'pdma',
    'pmd',
    'warning',
  ];

  const pamirCandidateUrls = items
    .map((el) => $('link', el).text().trim() || $('guid', el).text().trim())
    .filter(Boolean);
  const pamirExistingUrls = await getExistingUrlSet(pamirCandidateUrls);

  let inserted = 0;

  for (const el of items) {
    const title = $('title', el).first().text().trim();
    const link = $('link', el).text().trim() || $('guid', el).text().trim();
    const pubDateRaw = $('pubDate', el).text().trim();
    const description = $('description', el)
      .text()
      .trim()
      .replace(/<[^>]+>/g, ' ')
      .trim();

    if (!title || title.length < 5) continue;

    const combined = (title + ' ' + description).toLowerCase();

    // Must mention GB region AND be disaster-related
    if (!isGbRelevant(combined)) continue;
    if (!DISASTER_KEYWORDS.some((kw) => combined.includes(kw))) continue;

    const sourceUrl = link || null;
    if (sourceUrl && pamirExistingUrls.has(sourceUrl)) continue;

    const issuedAt = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const safeDate = isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

    await insertAlert({
      title: title.slice(0, 500),
      body: description.slice(0, 3000) || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceId,
      sourceUrl,
      issuedAt: safeDate,
    });
    inserted++;
  }

  console.log(
    `[alerts] Pamir Times: ${inserted} new disaster alerts inserted (${items.length} items scanned)`,
  );
}

// ─── GDACS RSS ────────────────────────────────────────────────────────────────
// UN Global Disaster Alert and Coordination System. Free public RSS feed.
// Covers Pakistan-level floods and landslides; filtered further for GB keywords.

async function scrapeGDACS(sourceId: number | null) {
  console.log('[alerts] Fetching GDACS RSS');

  const res = await fetch(GDACS_RSS, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    console.error(`[alerts] GDACS RSS HTTP ${res.status}`);
    return;
  }

  const xml = await res.text();
  const $ = cheerio.load(xml, { xml: true });
  const items = $('item').toArray();

  const gdacsCandidateUrls = items
    .map((el) => $('link', el).text().trim() || $('guid', el).text().trim())
    .filter(Boolean);
  const gdacsExistingUrls = await getExistingUrlSet(gdacsCandidateUrls);

  let inserted = 0;

  for (const el of items) {
    const title = $('title', el).first().text().trim();
    const link = $('link', el).text().trim() || $('guid', el).text().trim();
    const pubDateRaw = $('pubDate', el).text().trim();
    const description = $('description', el)
      .text()
      .trim()
      .replace(/<[^>]+>/g, ' ')
      .trim();

    if (!title || title.length < 5) continue;

    const combined = title + ' ' + description;

    // GDACS is global — only take Pakistan events, prefer GB-specific ones
    if (!isPakistanRelevant(combined)) continue;

    const sourceUrl = link || null;
    if (sourceUrl && gdacsExistingUrls.has(sourceUrl)) continue;

    const issuedAt = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const safeDate = isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

    // Boost level for GDACS: they only publish significant events
    const baseLevel = inferLevel(combined);
    const level = baseLevel === 'advisory' ? 'watch' : baseLevel;

    await insertAlert({
      title: title.slice(0, 500),
      body: description.slice(0, 3000) || title,
      alertType: inferAlertType(combined),
      level,
      district: null,
      sourceId,
      sourceUrl,
      issuedAt: safeDate,
    });
    inserted++;
  }

  console.log(
    `[alerts] GDACS: ${inserted} Pakistan/GB alerts inserted (${items.length} items scanned)`,
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function checkAlerts() {
  console.log('[alerts] Starting alert check');

  const [reliefwebSourceId, pamirTimesSourceId, gdacsSourceId] = await Promise.all([
    getSourceId('reliefweb'),
    getSourceId('pamir-times'),
    getSourceId('gdacs'),
  ]);

  await Promise.all([
    scrapeReliefWeb(reliefwebSourceId).catch((e) =>
      console.error('[alerts] ReliefWeb scraper error:', e),
    ),
    scrapePamirTimes(pamirTimesSourceId).catch((e) =>
      console.error('[alerts] Pamir Times scraper error:', e),
    ),
    scrapeGDACS(gdacsSourceId).catch((e) => console.error('[alerts] GDACS scraper error:', e)),
  ]);

  console.log('[alerts] Alert check complete');
}
