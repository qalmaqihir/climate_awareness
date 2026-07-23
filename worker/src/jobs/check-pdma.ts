/**
 * Superseded by check-alerts.ts.
 *
 * Previous targets:
 *   - NDMA /public/situation-reports → 404 (dead path); now covered via ReliefWeb API
 *   - pdma.gob.pk → Balochistan province, not GB; removed
 *   - PMD /en/warnings/ → Cloudflare-blocked; removed
 *
 * GB-specific alerts now come from:
 *   1. ReliefWeb API (aggregates NDMA/PMD situation reports)
 *   2. Pamir Times RSS (https://www.pamirtimes.net/feed/)
 *   3. GDACS RSS (https://www.gdacs.org/xml/rss.xml)
 *
 * See check-alerts.ts for implementation.
 */
export async function checkPdmaAlerts() {
  // No-op — logic moved to checkAlerts() in check-alerts.ts
}
