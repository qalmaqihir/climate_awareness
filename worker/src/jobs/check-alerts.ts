/**
 * Fetches GB-relevant alerts from four sources:
 *   1. ReliefWeb API v2 — UN OCHA platform, aggregates Pakistan NDMA/PMD/PDMA reports (free JSON API)
 *   2. Pamir Times RSS — leading English-language GB newspaper, real-time disaster coverage
 *   3. GDACS RSS — UN global disaster alert system, Pakistan-filtered
 *   4. Chitral Times RSS — leading English/Urdu newspaper for Chitral (Upper + Lower Chitral)
 *
 * PMD removed: Cloudflare-blocked as of 2026.
 * NDMA /public/situation-reports: 404 — covered via ReliefWeb instead.
 * PDMA KPK (pdma.kpk.gov.pk): DNS unreachable outside Pakistan — replaced by Chitral Times.
 * ReliefWeb v1 decommissioned 2026 → updated to v2 (requires registered appname).
 *
 * Deduplication: handled atomically by INSERT ... ON CONFLICT (source_url) DO NOTHING.
 * The alerts.source_url column has a UNIQUE constraint (migration 0006).
 * Runs every hour via cron in index.ts.
 */
import * as cheerio from 'cheerio';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';

const RELIEFWEB_URL = 'https://api.reliefweb.int/v2/reports';
const PAMIR_TIMES_RSS = 'https://pamirtimes.net/feed/';
const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';
const CHITRAL_TIMES_RSS = 'https://chitraltimes.com/feed/';

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

interface AlertCandidate {
  title: string;
  body: string;
  alertType: string;
  level: string;
  district: string | null;
  sourceUrl: string | null;
  issuedAt: Date;
}

/**
 * Batch-inserts alert candidates using ON CONFLICT (source_url) DO NOTHING.
 * Requires the UNIQUE constraint on alerts.source_url (migration 0006).
 * Returns the number of rows actually inserted.
 */
async function batchInsertAlerts(
  candidates: AlertCandidate[],
  sourceId: number | null,
): Promise<number> {
  if (candidates.length === 0) return 0;

  const result = await db.execute(sql`
    INSERT INTO alerts
      (title, body, alert_type, level, district, source_id, source_url, is_active, issued_at)
    VALUES
      ${sql.join(
        candidates.map(
          (c) => sql`(
            ${c.title.slice(0, 500)},
            ${c.body.slice(0, 3000)},
            ${c.alertType},
            ${c.level},
            ${c.district},
            ${sourceId},
            ${c.sourceUrl},
            true,
            ${c.issuedAt.toISOString()}
          )`,
        ),
        sql`, `,
      )}
    ON CONFLICT (source_url) DO NOTHING
  `);

  return (result.rowCount as number | null) ?? 0;
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
    if (res.status === 403) {
      console.warn(
        '[alerts] ReliefWeb v2: access denied — appname not approved. Register at https://apidoc.reliefweb.int/parameters#appname',
      );
    } else {
      console.error(`[alerts] ReliefWeb HTTP ${res.status}`);
    }
    return;
  }

  const json = (await res.json()) as { data?: Array<{ fields: Record<string, unknown> }> };
  const items = json.data ?? [];

  const candidates: AlertCandidate[] = [];

  for (const item of items) {
    const f = item.fields;
    const title = String(f.title ?? '').trim();
    const body = String(f.body ?? title).trim();
    const url = String(f.url ?? '').trim();
    const dateStr = (f.date as { created?: string } | undefined)?.created;
    const issuedAt = dateStr ? new Date(dateStr) : new Date();

    if (!title || !isGbRelevant(title + ' ' + body)) continue;

    const combined = title + ' ' + body;
    candidates.push({
      title,
      body: body || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceUrl: url || null,
      issuedAt,
    });
  }

  const inserted = await batchInsertAlerts(candidates, sourceId);
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

  const candidates: AlertCandidate[] = [];

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

    const issuedAt = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const safeDate = isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

    candidates.push({
      title: title.slice(0, 500),
      body: description.slice(0, 3000) || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceUrl: link || null,
      issuedAt: safeDate,
    });
  }

  const inserted = await batchInsertAlerts(candidates, sourceId);
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

  const candidates: AlertCandidate[] = [];

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

    const issuedAt = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const safeDate = isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

    // Boost level for GDACS: they only publish significant events
    const baseLevel = inferLevel(combined);
    const level = baseLevel === 'advisory' ? 'watch' : baseLevel;

    candidates.push({
      title: title.slice(0, 500),
      body: description.slice(0, 3000) || title,
      alertType: inferAlertType(combined),
      level,
      district: null,
      sourceUrl: link || null,
      issuedAt: safeDate,
    });
  }

  const inserted = await batchInsertAlerts(candidates, sourceId);
  console.log(
    `[alerts] GDACS: ${inserted} Pakistan/GB alerts inserted (${items.length} items scanned)`,
  );
}

// ─── Chitral Times RSS ────────────────────────────────────────────────────────
// Leading English/Urdu newspaper for Chitral (Upper + Lower Chitral, KPK).
// Replaces the unreachable PDMA KPK direct scraper.
// Content is a mix of English and Urdu Unicode. All articles are Chitral-specific
// so GB-relevance is assumed; the AI verifier suppresses non-disaster items.

async function scrapeChitralTimes(sourceId: number | null) {
  console.log('[alerts] Fetching Chitral Times RSS');

  // Chitral Times sits behind Cloudflare — needs a browser-like UA
  const res = await fetch(CHITRAL_TIMES_RSS, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    console.error(`[alerts] Chitral Times RSS HTTP ${res.status}`);
    return;
  }

  const xml = await res.text();
  const $ = cheerio.load(xml, { xml: true });
  const items = $('item').toArray();

  // Disaster keywords (English + key Urdu Unicode terms for flood/emergency/landslide)
  const DISASTER_KW_EN = [
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
    'damage',
    'selab',
    'relief',
    'rescue',
    'evacuation',
    'devastat',
  ];
  // Key Urdu Unicode fragments: سیلاب=flood, ہنگام=emergency, لینڈسلائیڈ=landslide, طوفان=storm
  const DISASTER_KW_UR = ['سیلاب', 'ہنگام', 'لینڈسلائیڈ', 'طوفان', 'زلزلہ', 'نقصان', 'بارش'];

  const candidates: AlertCandidate[] = [];

  for (const el of items) {
    const title = $('title', el).first().text().trim();
    const link = $('link', el).text().trim() || $('guid', el).text().trim();
    const pubDateRaw = $('pubDate', el).text().trim();
    const description = $('description', el)
      .text()
      .replace(/<[^>]+>/g, ' ')
      .trim();

    if (!title || title.length < 3) continue;

    const combined = (title + ' ' + description).toLowerCase();

    // All Chitral Times articles are Chitral-specific — skip the GB-relevance check.
    // Must match at least one disaster keyword (English or Urdu) to avoid ingest noise.
    const isDisasterRelated =
      DISASTER_KW_EN.some((kw) => combined.includes(kw)) ||
      DISASTER_KW_UR.some((kw) => (title + description).includes(kw));

    if (!isDisasterRelated) continue;

    const issuedAt = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const safeDate = isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

    candidates.push({
      title: title.slice(0, 500),
      body: description.slice(0, 3000) || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceUrl: link || null,
      issuedAt: safeDate,
    });
  }

  const inserted = await batchInsertAlerts(candidates, sourceId);
  console.log(
    `[alerts] Chitral Times: ${inserted} new disaster alerts inserted (${items.length} items scanned)`,
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function checkAlerts() {
  console.log('[alerts] Starting alert check');

  const [reliefwebSourceId, pamirTimesSourceId, gdacsSourceId, chitralTimesSourceId] =
    await Promise.all([
      getSourceId('reliefweb'),
      getSourceId('pamir-times'),
      getSourceId('gdacs'),
      getSourceId('chitral-times'),
    ]);

  await Promise.all([
    scrapeReliefWeb(reliefwebSourceId).catch((e) =>
      console.error('[alerts] ReliefWeb scraper error:', e),
    ),
    scrapePamirTimes(pamirTimesSourceId).catch((e) =>
      console.error('[alerts] Pamir Times scraper error:', e),
    ),
    scrapeGDACS(gdacsSourceId).catch((e) => console.error('[alerts] GDACS scraper error:', e)),
    scrapeChitralTimes(chitralTimesSourceId).catch((e) =>
      console.error('[alerts] Chitral Times scraper error:', e),
    ),
  ]);

  console.log('[alerts] Alert check complete');
}
