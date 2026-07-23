/**
 * One-time script to fix broken / generic source URLs in the events table.
 *
 * Broken URLs found and confirmed:
 *   - https://ndma.gov.pk/disaster-reports        → 404
 *   - https://www.icimod.org/article/glacial-lake-outburst-floods-in-the-hunza-valley → 404
 *   - https://reliefweb.int/country/pak            → generic country page (not event-specific)
 *   - https://www.pamirtimes.net                   → homepage only
 *
 * Replacements use the most specific valid URL available per event.
 * Run: pnpm db:fix-source-urls
 * Safe to re-run — UPDATE is idempotent.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Confirmed-valid source URLs
const RELIEFWEB_2022 = 'https://reliefweb.int/disasters/fl-2022-000332-pak';
const RELIEFWEB_2021 = 'https://reliefweb.int/disasters/fl-2021-000141-pak';
const RELIEFWEB_PAKISTAN = 'https://reliefweb.int/country/pak';
const PAMIR_2022_REPORT =
  'https://pamirtimes.net/2022/08/26/110-flashflood-disasters-in-gilgit-baltistan-since-july-2022-official-report/';
const ICIMOD_GLOF_HUNZA =
  'https://www.icimod.org/increasing-risk-of-glacial-lake-outburst-floods-in-hunza-river-basin/';
const PAMIR_ATTABAD_2023 =
  'https://pamirtimes.net/2023/04/09/hunza-businesses-worried-about-delays-in-reconstruction-of-collapsed-bridge/';

interface Fix {
  titleContains: string;
  newUrl: string;
  newSourceSlug: string;
}

const FIXES: Fix[] = [
  // ── ICIMOD 404 → valid ICIMOD GLOF article ───────────────────────────────
  {
    titleContains: 'Shishper Glacier second GLOF season surge',
    newUrl: ICIMOD_GLOF_HUNZA,
    newSourceSlug: 'icimod',
  },
  {
    titleContains: 'Nagar Hoper Glacier GLOF',
    newUrl: ICIMOD_GLOF_HUNZA,
    newSourceSlug: 'icimod',
  },
  {
    titleContains: 'Shishper Glacier GLOF season resumes',
    newUrl: ICIMOD_GLOF_HUNZA,
    newSourceSlug: 'icimod',
  },
  {
    titleContains: 'Hoper Glacier GLOF causes infrastructure damage',
    newUrl: ICIMOD_GLOF_HUNZA,
    newSourceSlug: 'icimod',
  },

  // ── NDMA 404 (2022) → Pamir Times official GB flood report ───────────────
  {
    titleContains: 'Gilgit city flash floods from multiple hill torrents',
    newUrl: PAMIR_2022_REPORT,
    newSourceSlug: 'pamir-times',
  },
  {
    titleContains: 'Ghizer River major flood damages Phander',
    newUrl: PAMIR_2022_REPORT,
    newSourceSlug: 'pamir-times',
  },
  {
    titleContains: 'Skardu flash flood damages Satpara Road',
    newUrl: PAMIR_2022_REPORT,
    newSourceSlug: 'pamir-times',
  },
  {
    titleContains: 'Ghanche district cloud burst and flash flood',
    newUrl: PAMIR_2022_REPORT,
    newSourceSlug: 'pamir-times',
  },
  {
    titleContains: 'Astore River flash flood damages Astore town',
    newUrl: RELIEFWEB_2022,
    newSourceSlug: 'reliefweb',
  },

  // ── ReliefWeb report URL → stable disaster page (better format) ──────────
  {
    titleContains: 'Shishper Glacier GLOF destroys Hassanabad Bridge',
    newUrl: RELIEFWEB_2022,
    newSourceSlug: 'reliefweb',
  },

  // ── Generic Pamir Times homepage → specific articles ─────────────────────
  {
    titleContains: 'Hunza KKH landslide blocks highway near Attabad',
    newUrl: PAMIR_ATTABAD_2023,
    newSourceSlug: 'pamir-times',
  },

  // ── NDMA 404 (2021) → ReliefWeb 2021 Pakistan floods ────────────────────
  {
    titleContains: 'Diamer district cloudburst and landslide cascade',
    newUrl: RELIEFWEB_2021,
    newSourceSlug: 'reliefweb',
  },
  {
    titleContains: 'Astore River bridges and road damaged',
    newUrl: RELIEFWEB_2021,
    newSourceSlug: 'reliefweb',
  },

  // ── NDMA 404 (2023/2024) → ReliefWeb Pakistan country page ─────────────
  {
    titleContains: 'Skardu Shigar Valley flash flood',
    newUrl: RELIEFWEB_PAKISTAN,
    newSourceSlug: 'reliefweb',
  },
  {
    titleContains: 'Astore district flash floods, multiple villages',
    newUrl: RELIEFWEB_PAKISTAN,
    newSourceSlug: 'reliefweb',
  },
  {
    titleContains: 'Passu Glacier GLOF threatens Gojal Valley',
    newUrl: RELIEFWEB_PAKISTAN,
    newSourceSlug: 'reliefweb',
  },
  {
    titleContains: 'Kharmang Valley flash flood, multiple bridge failures',
    newUrl: RELIEFWEB_PAKISTAN,
    newSourceSlug: 'reliefweb',
  },
  {
    titleContains: 'Ghizer Valley flash floods damage Ishkoman road',
    newUrl: RELIEFWEB_PAKISTAN,
    newSourceSlug: 'reliefweb',
  },

  // ── Pamir Times events with no specific article found ───────────────────
  // Diamer Chilas 2024 and Astore Deosai 2024 keep pamirtimes.net (homepage
  // loads; no specific article URL found via search). No change needed.
];

async function getSourceId(slug: string): Promise<number | null> {
  const res = await db.execute(sql`SELECT id FROM sources WHERE slug = ${slug} LIMIT 1`);
  return (res.rows[0]?.id as number) ?? null;
}

async function main() {
  console.log('Fixing broken source URLs in events table…\n');

  const sourceIdCache: Record<string, number | null> = {};

  let updated = 0;
  let notFound = 0;

  for (const fix of FIXES) {
    const slug = fix.newSourceSlug;
    if (!(slug in sourceIdCache)) {
      sourceIdCache[slug] = await getSourceId(slug);
    }
    const sourceId = sourceIdCache[slug];

    const result = await db.execute(sql`
      UPDATE events
      SET
        source_url  = ${fix.newUrl},
        source_id   = ${sourceId},
        updated_at  = NOW()
      WHERE title ILIKE ${'%' + fix.titleContains + '%'}
        AND source_url != ${fix.newUrl}
      RETURNING id, title, source_url
    `);

    if (result.rows.length > 0) {
      for (const row of result.rows) {
        console.log(`  ✓ [id=${row.id}] ${String(row.title).slice(0, 70)}`);
        console.log(`      → ${fix.newUrl}`);
      }
      updated += result.rows.length;
    } else {
      // Either already fixed or title not found
      const check = await db.execute(
        sql`SELECT id FROM events WHERE title ILIKE ${'%' + fix.titleContains + '%'} LIMIT 1`,
      );
      if (check.rows.length === 0) {
        console.log(`  ? [NOT FOUND] "${fix.titleContains}"`);
        notFound++;
      } else {
        console.log(`  – [ALREADY OK] "${fix.titleContains}"`);
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}  Not found: ${notFound}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
