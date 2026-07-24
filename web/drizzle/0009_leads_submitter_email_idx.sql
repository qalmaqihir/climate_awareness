-- Covers the sliding-window rate-limit query in POST /api/leads:
--   WHERE submitter_email = ? AND created_at > ?
-- Without this index every submission attempt does a full scan of the leads table.

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_submitter_email_idx"
  ON "leads" ("submitter_email", "created_at" DESC);
