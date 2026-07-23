import cron from 'node-cron';
import { refreshWeather } from './jobs/refresh-weather.js';
import { checkPdmaAlerts } from './jobs/check-pdma.js';
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

// PDMA/NDMA alert check every hour
cron.schedule('0 * * * *', async () => {
  console.log('[cron] Triggering PDMA alert check');
  await checkPdmaAlerts().catch((e) => console.error('[cron] pdma error:', e));
});

console.log('[worker] Crons scheduled. Running initial jobs…');

// Run immediately on startup
await Promise.all([
  refreshWeather().catch((e) => console.error('[startup] weather error:', e)),
  checkPdmaAlerts().catch((e) => console.error('[startup] pdma error:', e)),
]);

console.log('[worker] Ready. Waiting for scheduled triggers.');

// Keep process alive
process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received, shutting down');
  await pool.end();
  process.exit(0);
});
