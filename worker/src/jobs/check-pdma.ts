/**
 * Scrapes NDMA/PDMA GB situation reports and upserts into alerts.
 *
 * TODO (Phase 1.E.3): NDMA publishes daily situation reports as PDFs.
 * Current approach: scrape the HTML situation report page for table rows.
 *
 * Target: https://ndma.gov.pk/situation-reports/
 * Fallback: PMD warnings at https://www.pmd.gov.pk/en/warnings/
 *
 * Deduplication: by source_url. Skip if already exists.
 */
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

export async function checkPdmaAlerts() {
  console.log('[pdma] Starting NDMA/PDMA alert check');

  // Placeholder — full scraper in Phase 1.E.3
  // Pattern: fetch HTML → Cheerio parse → extract alert rows → upsert
  console.log('[pdma] Scraper not yet implemented — skipping');
}
