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
    description: 'Leading English-language newspaper for Gilgit-Baltistan.',
  },
  {
    name: 'Ibex Media Network',
    slug: 'ibex-media',
    url: 'https://www.ibexmedianetwork.com',
    type: 'media' as const,
    description: 'Regional news network covering GB climate and disaster events.',
  },
  {
    name: 'PDMA Gilgit-Baltistan',
    slug: 'pdma-gb',
    url: 'https://pdma.gob.pk',
    type: 'government' as const,
    description: 'Provincial Disaster Management Authority for Gilgit-Baltistan.',
  },
  {
    name: 'NDMA Pakistan',
    slug: 'ndma',
    url: 'https://ndma.gov.pk',
    type: 'government' as const,
    description: 'National Disaster Management Authority — national-level alerts.',
  },
  {
    name: 'Pakistan Meteorological Department',
    slug: 'pmd',
    url: 'https://www.pmd.gov.pk',
    type: 'government' as const,
    description: 'Official weather and GLOF early warning authority.',
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
