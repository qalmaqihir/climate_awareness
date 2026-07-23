/**
 * P0.2 — Backfill reviewed coordinates onto the 22 seeded events.
 *
 * Run: pnpm db:backfill-locations
 *
 * Safe to re-run: already-correct rows are detected and skipped.
 * Dry run: DATABASE_URL=<url> DRY_RUN=1 pnpm db:backfill-locations
 *
 * What this script does:
 *   1. Sets PostGIS location geometry from reviewed lat/lng coordinates.
 *   2. Sets location_precision and location_rationale on every matched event.
 *   3. Normalises flash_flood eventType → eventType: flood, eventSubtype: flash_flood.
 *   4. Corrects known district errors (Kharmang event mis-assigned to Skardu).
 *   5. Sets state: resolved on all historical events (no ongoing acute impact).
 *
 * All coordinates were reviewed against cited sources before being committed.
 * See scripts/seed-locations.ts for the reviewed data with per-event rationale.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { SEED_LOCATIONS } from './seed-locations';
import { isWithinCoverage } from '../src/lib/constants';

const DRY_RUN = process.env.DRY_RUN === '1';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface EventRecord extends Record<string, unknown> {
  id: number;
  title: string;
  event_type: string;
  event_subtype: string | null;
  district: string | null;
  location_precision: string | null;
  state: string;
  location: string | null;
}

async function main() {
  console.log(`P0.2 seed location backfill${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log(`Processing ${SEED_LOCATIONS.length} reviewed locations…\n`);

  // Validate all reviewed coordinates before touching the database.
  const invalid = SEED_LOCATIONS.filter((s) => !isWithinCoverage(s.lat, s.lng));
  if (invalid.length > 0) {
    console.error('ERROR: The following coordinates are outside the coverage envelope:');
    for (const s of invalid) {
      console.error(`  ${s.title}: lat=${s.lat}, lng=${s.lng}`);
    }
    process.exit(1);
  }
  console.log(`✓ All ${SEED_LOCATIONS.length} coordinates within coverage envelope\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const loc of SEED_LOCATIONS) {
    // Look up the event by title.
    const result = await db.execute<EventRecord>(
      sql`SELECT id, title, event_type, event_subtype, district, location_precision, state,
               ST_AsText(location::geometry) AS location
          FROM events
          WHERE title = ${loc.title}
          LIMIT 1`,
    );

    if (result.rows.length === 0) {
      console.warn(`  NOT FOUND: "${loc.title}"`);
      notFound++;
      continue;
    }

    const row = result.rows[0];
    const targetEventType = loc.eventType ?? row.event_type;
    const targetSubtype = loc.eventSubtype ?? null;
    const targetDistrict = loc.districtOverride ?? row.district;
    const wkt = `POINT(${loc.lng} ${loc.lat})`;

    // Detect whether this row already has the correct values.
    const alreadyLocated =
      row.location != null &&
      row.location_precision === loc.precision &&
      row.event_type === targetEventType &&
      row.event_subtype === targetSubtype &&
      row.district === targetDistrict &&
      row.state === loc.state;

    if (alreadyLocated) {
      console.log(`  skip [${loc.precision}] ${loc.title.slice(0, 70)}`);
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await db.execute(sql`
        UPDATE events
        SET
          location           = ST_GeogFromText(${wkt}),
          location_precision = ${loc.precision},
          location_rationale = ${loc.rationale},
          event_type         = ${targetEventType},
          event_subtype      = ${targetSubtype},
          district           = ${targetDistrict},
          state              = ${loc.state},
          updated_at         = now()
        WHERE id = ${row.id}
      `);
    }

    const changes: string[] = [];
    if (row.location == null) changes.push('location set');
    if (row.location_precision !== loc.precision) changes.push(`precision: ${loc.precision}`);
    if (row.event_type !== targetEventType)
      changes.push(`type: ${row.event_type}→${targetEventType}`);
    if (row.event_subtype !== targetSubtype) changes.push(`subtype: ${targetSubtype ?? 'null'}`);
    if (row.district !== targetDistrict)
      changes.push(`district: ${row.district}→${targetDistrict}`);
    if (row.state !== loc.state) changes.push(`state: ${row.state}→${loc.state}`);

    console.log(
      `  ${DRY_RUN ? 'would update' : 'updated'} [${loc.precision}] ${loc.title.slice(0, 60)} (${changes.join(', ')})`,
    );
    updated++;
  }

  console.log(`\n─── Summary ───────────────────────────────────────────────`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Not found: ${notFound}`);
  if (DRY_RUN) console.log(`  (dry run — no changes written)`);

  if (notFound > 0) {
    console.error(`\n${notFound} event(s) not found in the database.`);
    console.error('Run pnpm db:seed-events first to seed missing events.');
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
