/**
 * pgvector similarity search over the events table.
 * Uses cosine distance (<=>). No ORM abstraction — raw SQL for full control.
 *
 * Index note: with <1000 events, sequential scan is fast enough.
 * When events > 1000, add: CREATE INDEX CONCURRENTLY events_embedding_v1_hnsw_idx
 *   ON events USING hnsw (embedding_v1 vector_cosine_ops);
 */
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { RetrievedDoc } from './types';

export async function searchSimilar(embedding: number[], topK = 6): Promise<RetrievedDoc[]> {
  const vecStr = `[${embedding.join(',')}]`;

  const res = await db.execute(sql`
    SELECT
      id,
      title,
      description,
      district,
      event_type,
      severity,
      source_url,
      to_char(reported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS reported_date,
      1 - (embedding_v1 <=> ${vecStr}::vector) AS similarity
    FROM events
    WHERE status = 'verified'
      AND embedding_v1 IS NOT NULL
    ORDER BY embedding_v1 <=> ${vecStr}::vector
    LIMIT ${topK}
  `);

  return res.rows.map((row) => ({
    id: row.id as number,
    title: row.title as string,
    content: ((row.description ?? row.title) as string).slice(0, 600),
    district: row.district as string | null,
    eventType: row.event_type as string,
    severity: row.severity as string,
    sourceUrl: row.source_url as string | null,
    reportedAt: row.reported_date as string,
    similarity: parseFloat(String(row.similarity ?? 0)),
  }));
}
