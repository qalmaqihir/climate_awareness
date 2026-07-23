import { db } from '../db.js';
import { sql } from 'drizzle-orm';

export async function runCleanup() {
  try {
    const result = await db.execute(
      sql`DELETE FROM query_logs WHERE created_at < NOW() - INTERVAL '90 days'`,
    );
    const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (count > 0) console.log(`[cleanup] Pruned ${count} query_logs rows older than 90 days`);
  } catch (err) {
    console.error('[cleanup] query_logs prune failed:', err);
  }
}
