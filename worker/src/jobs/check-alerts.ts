/**
 * Fetches GB-relevant alerts from two sources:
 *   1. ReliefWeb API — UN OCHA platform, aggregates Pakistan NDMA/PMD/PDMA reports (free JSON API)
 *   2. PMD warnings page — official GLOF/weather warnings (Cheerio HTML scrape)
 *
 * Deduplication: skip if source_url already exists in alerts table.
 * Runs every hour via cron in index.ts.
 */
import * as cheerio from 'cheerio';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';

const RELIEFWEB_URL = 'https://api.reliefweb.int/v1/reports';
const PMD_WARNINGS_URL = 'https://www.pmd.gov.pk/en/warnings/';

// Keywords that indicate an alert is relevant to Gilgit-Baltistan
const GB_KEYWORDS = [
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
];

function isGbRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return GB_KEYWORDS.some((kw) => lower.includes(kw));
}

function inferLevel(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('emergency') || lower.includes('red alert') || lower.includes('catastrophic'))
    return 'emergency';
  if (lower.includes('warning') || lower.includes('orange')) return 'warning';
  if (lower.includes('watch') || lower.includes('yellow')) return 'watch';
  return 'advisory';
}

function inferAlertType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('glof') || lower.includes('glacial lake')) return 'glof';
  if (lower.includes('flood')) return 'flood';
  if (lower.includes('landslide') || lower.includes('mudslide')) return 'landslide';
  if (lower.includes('weather') || lower.includes('rain') || lower.includes('monsoon'))
    return 'weather';
  return 'general';
}

async function getSourceId(slug: string): Promise<number | null> {
  const res = await db.execute(sql`SELECT id FROM sources WHERE slug = ${slug} LIMIT 1`);
  return (res.rows[0]?.id as number) ?? null;
}

async function alertExists(sourceUrl: string): Promise<boolean> {
  const res = await db.execute(sql`SELECT 1 FROM alerts WHERE source_url = ${sourceUrl} LIMIT 1`);
  return res.rows.length > 0;
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

async function scrapeReliefWeb(reliefwebSourceId: number | null) {
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
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`[alerts] ReliefWeb HTTP ${res.status}`);
    return;
  }

  const json = (await res.json()) as { data?: Array<{ fields: Record<string, unknown> }> };
  const items = json.data ?? [];

  let inserted = 0;
  for (const item of items) {
    const f = item.fields;
    const title = String(f.title ?? '').trim();
    const body = String(f.body ?? title).trim();
    const url = String(f.url ?? '').trim();
    const dateStr = (f.date as { created?: string } | undefined)?.created;
    const issuedAt = dateStr ? new Date(dateStr) : new Date();

    if (!title || !isGbRelevant(title + ' ' + body)) continue;
    if (url && (await alertExists(url))) continue;

    const combined = title + ' ' + body;
    await insertAlert({
      title,
      body: body || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceId: reliefwebSourceId,
      sourceUrl: url || null,
      issuedAt,
    });
    inserted++;
  }

  console.log(`[alerts] ReliefWeb: ${inserted} new GB-relevant reports inserted`);
}

// ─── PMD Warnings Page ────────────────────────────────────────────────────────

async function scrapePmd(pmdSourceId: number | null) {
  console.log('[alerts] Fetching PMD warnings page');

  const res = await fetch(PMD_WARNINGS_URL, {
    headers: { 'User-Agent': 'Climate-Awareness-GB/1.0 (+https://climate-gb.naseyou.nl)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`[alerts] PMD HTTP ${res.status}`);
    return;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  let inserted = 0;

  // PMD uses a WordPress-style listing — try multiple common selectors.
  // Each candidate represents one warning entry on the page.
  const candidates = $('article, .warning-entry, .alert-entry, .post, .entry').toArray();

  for (const el of candidates) {
    const titleEl = $(el).find('h1, h2, h3, h4, .title, .entry-title').first();
    const title = titleEl.text().trim();
    if (!title || title.length < 10) continue;

    const bodyText = $(el)
      .find('p, .content, .entry-content')
      .map((_, p) => $(p).text().trim())
      .toArray()
      .join(' ')
      .trim();

    // Link — prefer anchor on title, fall back to any link in card
    const rawHref =
      titleEl.find('a').attr('href') ?? $(el).find('a[href]').first().attr('href') ?? '';
    const sourceUrl = rawHref.startsWith('http')
      ? rawHref
      : rawHref
        ? `https://www.pmd.gov.pk${rawHref}`
        : null;

    const dateAttr =
      $(el).find('time[datetime]').attr('datetime') ??
      $(el).find('[class*="date"]').first().text().trim();
    const issuedAt = dateAttr ? new Date(dateAttr) : new Date();
    const safeDate = isNaN(issuedAt.getTime()) ? new Date() : issuedAt;

    const combined = title + ' ' + bodyText;
    if (!isGbRelevant(combined)) continue;
    if (sourceUrl && (await alertExists(sourceUrl))) continue;

    await insertAlert({
      title,
      body: bodyText || title,
      alertType: inferAlertType(combined),
      level: inferLevel(combined),
      district: null,
      sourceId: pmdSourceId,
      sourceUrl,
      issuedAt: safeDate,
    });
    inserted++;
  }

  if (inserted === 0 && candidates.length === 0) {
    // Page structure differs from expected — log a sample for debugging
    console.warn(
      '[alerts] PMD: no article/post elements found. First 500 chars:',
      html.slice(0, 500),
    );
  } else {
    console.log(
      `[alerts] PMD: ${inserted} new GB-relevant warnings inserted (${candidates.length} candidates scanned)`,
    );
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function checkAlerts() {
  console.log('[alerts] Starting alert check');

  const [reliefwebSourceId, pmdSourceId] = await Promise.all([
    getSourceId('reliefweb'),
    getSourceId('pmd'),
  ]);

  await Promise.all([
    scrapeReliefWeb(reliefwebSourceId).catch((e) =>
      console.error('[alerts] ReliefWeb scraper error:', e),
    ),
    scrapePmd(pmdSourceId).catch((e) => console.error('[alerts] PMD scraper error:', e)),
  ]);

  console.log('[alerts] Alert check complete');
}
