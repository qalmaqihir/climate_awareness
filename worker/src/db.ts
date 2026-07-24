import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createLogger } from './logger.js';

const logger = createLogger('db');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Without this listener an idle-client error becomes an uncaught exception
// that kills the worker process.
pool.on('error', (err) => {
  logger.error('Unexpected pool client error', { error: err.message });
});

export const db = drizzle(pool);
export { pool };
