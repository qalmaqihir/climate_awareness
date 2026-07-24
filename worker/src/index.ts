import cron from 'node-cron';
import { refreshWeather } from './jobs/refresh-weather.js';
import { checkAlerts } from './jobs/check-alerts.js';
import { verifyAlerts } from './jobs/verify-alerts.js';
import { embedUnindexedEvents } from './jobs/embed-events.js';
import { runCleanup } from './jobs/cleanup.js';
import { pool } from './db.js';

console.log('[worker] Starting Northern Pakistan Climate Watch worker');

if (!process.env.DATABASE_URL) {
  console.error('[worker] DATABASE_URL not set');
  process.exit(1);
}

// Weather refresh every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Triggering weather refresh');
  await refreshWeather().catch((e) => console.error('[cron] weather error:', e));
});

// Alert scraper: hourly — pulls from ReliefWeb, Pamir Times, GDACS
cron.schedule('0 * * * *', async () => {
  console.log('[cron] Triggering alert check');
  await checkAlerts().catch((e) => console.error('[cron] alerts error:', e));
});

// AI verification: runs 5 min after the alert scraper to catch newly inserted rows
cron.schedule('5,20,35,50 * * * *', async () => {
  console.log('[cron] Triggering AI alert verification');
  await verifyAlerts().catch((e) => console.error('[cron] verify error:', e));
});

// Embed unindexed events every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('[cron] Triggering embedding job');
  await embedUnindexedEvents().catch((e) => console.error('[cron] embed error:', e));
});

// Prune old query_logs and expired sms_otps daily at 03:00
cron.schedule('0 3 * * *', async () => {
  console.log('[cron] Triggering cleanup job');
  await runCleanup().catch((e) => console.error('[cron] cleanup error:', e));
});

console.log('[worker] Crons scheduled. Running initial jobs…');

// Startup sequence: scrape first so new alerts exist, then immediately verify them
await checkAlerts().catch((e) => console.error('[startup] alerts error:', e));
await Promise.all([
  refreshWeather().catch((e) => console.error('[startup] weather error:', e)),
  verifyAlerts().catch((e) => console.error('[startup] verify error:', e)),
  embedUnindexedEvents().catch((e) => console.error('[startup] embed error:', e)),
]);

console.log('[worker] Ready. Waiting for scheduled triggers.');

// Graceful shutdown — handles both Docker SIGTERM and dev Ctrl-C
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received, shutting down`);
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
