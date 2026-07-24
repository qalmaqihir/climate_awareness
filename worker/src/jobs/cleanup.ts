import { db } from '../db.js';
import { sql } from 'drizzle-orm';

export async function runCleanup() {
  // Prune stale query_logs (90-day retention)
  try {
    const result = await db.execute(
      sql`DELETE FROM query_logs WHERE created_at < NOW() - INTERVAL '90 days'`,
    );
    const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (count > 0) console.log(`[cleanup] Pruned ${count} query_logs rows older than 90 days`);
  } catch (err) {
    console.error('[cleanup] query_logs prune failed:', err);
  }

  // Prune expired SMS OTPs (10-min TTL enforced at insert; cleanup removes stragglers)
  try {
    const result = await db.execute(sql`DELETE FROM sms_otps WHERE expires_at < NOW()`);
    const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (count > 0) console.log(`[cleanup] Pruned ${count} expired sms_otps rows`);
  } catch (err) {
    console.error('[cleanup] sms_otps prune failed:', err);
  }
}
