import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { createLogger } from './logger';

const logger = createLogger('db');

if (!process.env.DATABASE_URL) {
  // Warn at startup rather than throw — Next.js SSG pages catch DB errors gracefully,
  // but a thrown error here during `next build` breaks the entire build.
  logger.warn('DATABASE_URL is not set — all DB operations will fail at runtime');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Without this listener an idle-client error emitted by the pool becomes an
// uncaught exception that crashes the Node process.
pool.on('error', (err) => {
  logger.error('Unexpected pool client error', { error: err.message });
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
