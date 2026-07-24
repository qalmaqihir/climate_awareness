-- Remove any duplicate source_url rows introduced before the constraint existed (keep lowest id).
DELETE FROM alerts a
USING alerts b
WHERE a.source_url IS NOT NULL
  AND a.source_url = b.source_url
  AND a.id > b.id;--> statement-breakpoint

-- Add UNIQUE constraint so ON CONFLICT (source_url) DO NOTHING can be used for atomic dedup.
-- NULL values are not considered equal in PostgreSQL UNIQUE constraints, so multiple
-- NULL source_url rows are still allowed (alerts without a trackable URL).
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_source_url_unique" UNIQUE("source_url");
