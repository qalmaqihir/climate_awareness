import cron from 'node-cron';
import { refreshWeather } from './jobs/refresh-weather.js';
import { checkAlerts } from './jobs/check-alerts.js';
import { verifyAlerts } from './jobs/verify-alerts.js';
import { embedUnindexedEvents } from './jobs/embed-events.js';
import { runCleanup } from './jobs/cleanup.js';
import { pool } from './db.js';
import { createLogger } from './logger.js';

const logger = createLogger('worker');

logger.info('Starting Northern Pakistan Climate Watch worker');

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL not set');
  process.exit(1);
}

// Weather refresh every 6 hours
cron.schedule('0 */6 * * *', async () => {
  logger.info('Triggering weather refresh');
  await refreshWeather().catch((e: unknown) =>
    logger.error('Weather job failed', { error: e instanceof Error ? e.message : String(e) }),
  );
});

// Alert scraper: hourly — pulls from ReliefWeb, Pamir Times, GDACS
cron.schedule('0 * * * *', async () => {
  logger.info('Triggering alert check');
  await checkAlerts().catch((e: unknown) =>
    logger.error('Alerts job failed', { error: e instanceof Error ? e.message : String(e) }),
  );
});

// AI verification: runs 5 min after the alert scraper to catch newly inserted rows
cron.schedule('5,20,35,50 * * * *', async () => {
  logger.info('Triggering AI alert verification');
  await verifyAlerts().catch((e: unknown) =>
    logger.error('Verify job failed', { error: e instanceof Error ? e.message : String(e) }),
  );
});

// Embed unindexed events every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  logger.info('Triggering embedding job');
  await embedUnindexedEvents().catch((e: unknown) =>
    logger.error('Embed job failed', { error: e instanceof Error ? e.message : String(e) }),
  );
});

// Prune old query_logs and expired sms_otps daily at 03:00
cron.schedule('0 3 * * *', async () => {
  logger.info('Triggering cleanup job');
  await runCleanup().catch((e: unknown) =>
    logger.error('Cleanup job failed', { error: e instanceof Error ? e.message : String(e) }),
  );
});

logger.info('Crons scheduled. Running initial jobs…');

// Startup sequence: scrape first so new alerts exist, then immediately verify them
await checkAlerts().catch((e: unknown) =>
  logger.error('Startup alerts job failed', { error: e instanceof Error ? e.message : String(e) }),
);
await Promise.all([
  refreshWeather().catch((e: unknown) =>
    logger.error('Startup weather job failed', {
      error: e instanceof Error ? e.message : String(e),
    }),
  ),
  verifyAlerts().catch((e: unknown) =>
    logger.error('Startup verify job failed', {
      error: e instanceof Error ? e.message : String(e),
    }),
  ),
  embedUnindexedEvents().catch((e: unknown) =>
    logger.error('Startup embed job failed', { error: e instanceof Error ? e.message : String(e) }),
  ),
]);

logger.info('Ready. Waiting for scheduled triggers.');

// Graceful shutdown — handles both Docker SIGTERM and dev Ctrl-C
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down`);
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
