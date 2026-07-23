/**
 * Post-processes generated Drizzle migration SQL to fix PostGIS type quoting.
 *
 * drizzle-kit wraps customType dataType() values in double quotes:
 *   "geography(Point, 4326)"  ← Postgres treats this as a quoted identifier, not a type
 *   geography(Point, 4326)    ← correct unquoted form
 *
 * Run automatically after db:generate via postdb:generate in package.json.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, '../drizzle');

const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => join(migrationsDir, f));

let fixed = 0;
for (const file of sqlFiles) {
  const original = readFileSync(file, 'utf8');
  const patched = original.replace(/"geography\(([^)]+)\)"/g, 'geography($1)');
  if (patched !== original) {
    writeFileSync(file, patched);
    console.log(`Fixed geography type quoting: ${file}`);
    fixed++;
  }
}

if (fixed === 0) {
  console.log('No geography type quoting fixes needed.');
}
