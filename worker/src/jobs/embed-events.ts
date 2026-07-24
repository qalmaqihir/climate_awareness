/**
 * Batch-embeds verified events that lack an embedding_v1 vector.
 * Uses the Jina AI v1 API (OpenAI-compatible, free tier, 1024-dim).
 *
 * Runs every 15 minutes via cron + on worker startup.
 * Processes up to 100 events per run in batches of 10.
 */
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const JINA_API = 'https://api.jina.ai/v1/embeddings';
const JINA_MODEL = 'jina-embeddings-v3';
const DIMENSIONS = 1024;
const BATCH_SIZE = 10;
const MAX_PER_RUN = 100;

interface JinaResponse {
  data: Array<{ embedding: number[] }>;
}

async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error('JINA_API_KEY not set');

  const res = await fetch(JINA_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: JINA_MODEL, input: texts, dimensions: DIMENSIONS }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Jina API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as JinaResponse;
  return json.data.map((d) => d.embedding);
}

function buildEmbeddingText(row: Record<string, unknown>): string {
  return [
    row.title as string,
    row.description ? String(row.description) : '',
    row.event_type ? `Type: ${row.event_type}` : '',
    row.severity ? `Severity: ${row.severity}` : '',
    row.district ? `District: ${row.district}` : '',
    row.location_name ? `Location: ${row.location_name}` : '',
    row.affected_count ? `Affected: ${row.affected_count} people` : '',
    row.reported_date ? `Date: ${row.reported_date}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

export async function embedUnindexedEvents() {
  if (!process.env.JINA_API_KEY) {
    console.log('[embed] JINA_API_KEY not set — skipping embedding job');
    return;
  }

  const unindexed = await db.execute(sql`
    SELECT
      id, title, description, event_type, district, location_name,
      severity, affected_count,
      to_char(reported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS reported_date
    FROM events
    WHERE status = 'verified' AND embedding_v1 IS NULL
    ORDER BY reported_at DESC
    LIMIT ${MAX_PER_RUN}
  `);

  if (unindexed.rows.length === 0) {
    console.log('[embed] All verified events are indexed');
    return;
  }

  console.log(`[embed] Indexing ${unindexed.rows.length} events`);
  let embedded = 0;

  for (let i = 0; i < unindexed.rows.length; i += BATCH_SIZE) {
    const batch = unindexed.rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    try {
      const embeddings = await fetchEmbeddings(texts);

      // Bulk UPDATE — one round-trip per batch instead of N individual updates
      await db.execute(
        sql`UPDATE events AS e
            SET embedding_v1 = v.vec::vector,
                updated_at = NOW()
            FROM (VALUES ${sql.join(
              batch.map((r, j) => sql`(${r.id as number}::int, ${`[${embeddings[j].join(',')}]`})`),
              sql`, `,
            )}) AS v(id, vec)
            WHERE e.id = v.id`,
      );

      embedded += batch.length;
      console.log(
        `[embed] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} events embedded`,
      );
    } catch (err) {
      console.error(`[embed] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
    }
  }

  console.log(`[embed] Done — ${embedded} events indexed`);
}
