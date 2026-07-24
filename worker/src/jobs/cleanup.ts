import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '../logger.js';

const logger = createLogger('cleanup');

export async function runCleanup() {
  // Prune stale query_logs (90-day retention)
  try {
    const result = await db.execute(
      sql`DELETE FROM query_logs WHERE created_at < NOW() - INTERVAL '90 days'`,
    );
    const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (count > 0) logger.info('Pruned query_logs', { count, retention: '90 days' });
  } catch (err) {
    logger.error('query_logs prune failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Prune expired SMS OTPs (10-min TTL enforced at insert; cleanup removes stragglers)
  try {
    const result = await db.execute(sql`DELETE FROM sms_otps WHERE expires_at < NOW()`);
    const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (count > 0) logger.info('Pruned expired sms_otps', { count });
  } catch (err) {
    logger.error('sms_otps prune failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
