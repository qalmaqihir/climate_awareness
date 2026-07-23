/**
 * Hybrid retrieval: pgvector cosine similarity + Postgres full-text search (BM25-style),
 * fused with Reciprocal Rank Fusion (RRF, k=60 per the original paper).
 *
 * Why hybrid: vector search captures semantic intent; full-text captures exact keyword
 * matches (district names, event IDs, type keywords). RRF merges both ranked lists
 * without requiring score normalisation across different scoring functions.
 *
 * Similarity threshold: docs that appear only in the vector arm AND have cosine
 * similarity < 0.25 are excluded. Docs with any FTS match are always kept —
 * a keyword match is always relevant regardless of embedding distance.
 *
 * Scaling note: sequential scan is fast for <1 000 events. When events > 1 000:
 *   CREATE INDEX CONCURRENTLY events_embedding_v1_hnsw_idx
 *     ON events USING hnsw (embedding_v1 vector_cosine_ops);
 *   CREATE INDEX CONCURRENTLY events_fts_idx
 *     ON events USING gin(to_tsvector('english', coalesce(title,'') || ' ' ||
 *       coalesce(description,'') || ' ' || coalesce(district,'') || ' ' ||
 *       coalesce(location_name,'')));
 */
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { RetrievedDoc } from './types';

const SIMILARITY_THRESHOLD = 0.25;
const CANDIDATE_LIMIT = 20; // candidates from each retrieval arm before fusion
const RRF_K = 60; // standard constant from Cormack et al. 2009

export async function searchSimilar(
  embedding: number[],
  queryText: string,
  topK = 6,
): Promise<RetrievedDoc[]> {
  const vecStr = `[${embedding.join(',')}]`;

  const res = await db.execute(sql`
    WITH
    -- Arm 1: vector search — nearest neighbours by cosine distance
    vec AS (
      SELECT
        id,
        1 - (embedding_v1 <=> ${vecStr}::vector) AS cosine_sim,
        ROW_NUMBER() OVER (ORDER BY embedding_v1 <=> ${vecStr}::vector) AS vec_rank
      FROM events
      WHERE status = 'verified' AND embedding_v1 IS NOT NULL
      ORDER BY embedding_v1 <=> ${vecStr}::vector
      LIMIT ${CANDIDATE_LIMIT}
    ),
    -- Arm 2: full-text search — BM25-style ts_rank over title, description, district, location
    fts AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          ORDER BY ts_rank(
            to_tsvector('english',
              COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' ||
              COALESCE(district, '') || ' ' || COALESCE(location_name, '')
            ),
            websearch_to_tsquery('english', ${queryText})
          ) DESC
        ) AS fts_rank
      FROM events
      WHERE status = 'verified'
        AND to_tsvector('english',
              COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' ||
              COALESCE(district, '') || ' ' || COALESCE(location_name, '')
            ) @@ websearch_to_tsquery('english', ${queryText})
      LIMIT ${CANDIDATE_LIMIT}
    ),
    -- Fuse: Reciprocal Rank Fusion (RRF)
    -- Threshold: drop docs that only appear in the vector arm with low cosine similarity.
    -- Docs with any FTS match are always included — keyword match implies relevance.
    rrf AS (
      SELECT
        COALESCE(vec.id, fts.id) AS id,
        COALESCE(1.0 / (${RRF_K}::float + vec.vec_rank), 0.0) +
        COALESCE(1.0 / (${RRF_K}::float + fts.fts_rank), 0.0) AS rrf_score,
        COALESCE(vec.cosine_sim, 0.0) AS cosine_sim
      FROM vec
      FULL OUTER JOIN fts ON vec.id = fts.id
      WHERE vec.cosine_sim >= ${SIMILARITY_THRESHOLD} OR fts.id IS NOT NULL
    )
    SELECT
      e.id,
      e.title,
      e.description,
      e.district,
      e.event_type,
      e.severity,
      e.source_url,
      e.affected_count,
      to_char(e.reported_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS reported_date,
      r.rrf_score,
      r.cosine_sim
    FROM events e
    JOIN rrf r ON e.id = r.id
    ORDER BY r.rrf_score DESC
    LIMIT ${topK}
  `);

  return res.rows.map((row) => ({
    id: row.id as number,
    title: row.title as string,
    content: ((row.description ?? row.title) as string).slice(0, 1500),
    district: row.district as string | null,
    eventType: row.event_type as string,
    severity: row.severity as string,
    sourceUrl: row.source_url as string | null,
    reportedAt: row.reported_date as string,
    affectedCount: row.affected_count as number | null,
    similarity: parseFloat(String(row.cosine_sim ?? 0)),
  }));
}
