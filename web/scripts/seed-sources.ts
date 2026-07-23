/**
 * Seeds the verified GB sources.
 * Run once after first migration: pnpm tsx scripts/seed-sources.ts
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sources } from '../src/lib/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const SOURCES = [
  {
    name: 'Pamir Times',
    slug: 'pamir-times',
    url: 'https://www.pamirtimes.net',
    type: 'media' as const,
    description: 'Leading English-language newspaper for Gilgit-Baltistan. Regularly updated.',
  },
  {
    name: 'Pakistan Meteorological Department',
    slug: 'pmd',
    url: 'https://www.pmd.gov.pk',
    type: 'government' as const,
    description:
      'Official weather and GLOF early warning authority. Referenced for manual event verification; direct scraping blocked by Cloudflare.',
  },
  {
    name: 'NDMA Pakistan',
    slug: 'ndma',
    url: 'https://ndma.gov.pk',
    type: 'government' as const,
    description:
      'National Disaster Management Authority — situation reports aggregated via ReliefWeb API.',
  },
  {
    name: 'GDACS',
    slug: 'gdacs',
    url: 'https://www.gdacs.org',
    type: 'academic' as const,
    description:
      'UN Global Disaster Alert and Coordination System. Free public RSS feed, Pakistan-filtered. Covers significant floods and landslides.',
  },
  {
    name: 'ReliefWeb',
    slug: 'reliefweb',
    url: 'https://reliefweb.int',
    type: 'academic' as const,
    description:
      'UN OCHA humanitarian information platform. Aggregates Pakistan NDMA/PMD/PDMA situation reports. Scraped via free API.',
  },
  {
    name: 'ICIMOD',
    slug: 'icimod',
    url: 'https://www.icimod.org',
    type: 'academic' as const,
    description:
      'International Centre for Integrated Mountain Development — HKH glacier research and GLOF database.',
  },
  {
    name: 'Aga Khan Agency for Habitat',
    slug: 'akah',
    url: 'https://www.akah.org',
    type: 'ngo' as const,
    status: 'inactive' as const,
    description: 'AKAH operates FOCUS and early-warning systems in GB. Phase 3 integration target.',
  },
  {
    name: 'Ibex Media Network',
    slug: 'ibex-media',
    url: 'https://www.ibexmedianetwork.com',
    type: 'media' as const,
    status: 'inactive' as const,
    description: 'Regional GB news network. Marked inactive — verify URL before activating.',
  },
  {
    name: 'PDMA Khyber Pakhtunkhwa',
    slug: 'pdma-kpk',
    url: 'https://pdma.kp.gov.pk',
    type: 'government' as const,
    status: 'active' as const,
    description:
      'Provincial Disaster Management Authority KPK — covers Chitral disaster alerts and flood situational reports.',
  },
  {
    name: 'Chitral Times',
    slug: 'chitral-times',
    url: 'https://www.chitral-times.pk',
    type: 'media' as const,
    status: 'active' as const,
    description:
      'Leading English/Urdu newspaper for Chitral district. Covers GLOF events, road blockages, and flood damage in Upper and Lower Chitral.',
  },
] satisfies (typeof sources.$inferInsert)[];

async function main() {
  console.log(`Seeding ${SOURCES.length} sources…`);
  await db.insert(sources).values(SOURCES).onConflictDoNothing();
  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
