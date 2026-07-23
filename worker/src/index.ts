import cron from 'node-cron';
import { refreshWeather } from './jobs/refresh-weather.js';
import { checkAlerts } from './jobs/check-alerts.js';
import { pool } from './db.js';

console.log('[worker] Starting Climate Awareness GB worker');

if (!process.env.DATABASE_URL) {
  console.error('[worker] DATABASE_URL not set');
  process.exit(1);
}

// Weather refresh every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Triggering weather refresh');
  await refreshWeather().catch((e) => console.error('[cron] weather error:', e));
});

// Alert scraper: ReliefWeb API + PMD warnings page, every hour
cron.schedule('0 * * * *', async () => {
  console.log('[cron] Triggering alert check');
  await checkAlerts().catch((e) => console.error('[cron] alerts error:', e));
});

console.log('[worker] Crons scheduled. Running initial jobs…');

// Run immediately on startup
await Promise.all([
  refreshWeather().catch((e) => console.error('[startup] weather error:', e)),
  checkAlerts().catch((e) => console.error('[startup] alerts error:', e)),
]);

console.log('[worker] Ready. Waiting for scheduled triggers.');

// Keep process alive — handle both SIGTERM (Docker stop) and SIGINT (Ctrl-C / dev).
async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, shutting down`);
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
