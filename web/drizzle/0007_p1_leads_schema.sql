-- P1.1: Trusted-contributor leads data model.
-- Adds role to users; adds leads, lead_evidence, incident_updates,
-- incident_relations, and review_decisions tables.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS guards).

--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'admin';

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
  "id"                 integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "submitter_id"       text REFERENCES "user"("id") ON DELETE SET NULL,
  "submitter_email"    text NOT NULL,
  "intake_channel"     text NOT NULL DEFAULT 'web',
  "title"              text NOT NULL,
  "description"        text NOT NULL,
  "event_type"         text,
  "event_subtype"      text,
  "location_description" text,
  "district"           text,
  "latitude"           real,
  "longitude"          real,
  "location_precision" text,
  "occurred_at"        timestamp with time zone,
  "reported_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "contact_permission" boolean NOT NULL DEFAULT false,
  "contact_info"       text,
  "state"              text NOT NULL DEFAULT 'submitted',
  "published_event_id" integer REFERENCES "events"("id") ON DELETE SET NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_state_idx"     ON "leads" ("state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_submitter_idx" ON "leads" ("submitter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_event_idx"     ON "leads" ("published_event_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_evidence" (
  "id"                  integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "lead_id"             integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "evidence_type"       text NOT NULL,
  "source_url"          text,
  "media_ref"           text,
  "description"         text,
  "privacy_state"       text NOT NULL DEFAULT 'private',
  "consent_given"       boolean NOT NULL DEFAULT false,
  "reviewer_visibility" text NOT NULL DEFAULT 'hidden',
  "reviewed_by"         text REFERENCES "user"("id") ON DELETE SET NULL,
  "reviewed_at"         timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_evidence_lead_idx" ON "lead_evidence" ("lead_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_updates" (
  "id"           integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "event_id"     integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "update_text"  text NOT NULL,
  "update_type"  text NOT NULL DEFAULT 'status',
  "author_id"    text REFERENCES "user"("id") ON DELETE SET NULL,
  "published_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"   timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_updates_event_idx" ON "incident_updates" ("event_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_relations" (
  "id"              integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "source_event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "target_event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "relation_type"   text NOT NULL,
  "note"            text,
  "created_by"      text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "incident_relations_pair_unique" UNIQUE ("source_event_id", "target_event_id")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_decisions" (
  "id"             integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "reviewer_id"    text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "reviewer_email" text NOT NULL,
  "target_type"    text NOT NULL,
  "target_id"      integer NOT NULL,
  "action"         text NOT NULL,
  "rationale"      text,
  "before_state"   jsonb,
  "after_state"    jsonb,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_decisions_target_idx"   ON "review_decisions" ("target_type", "target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_decisions_reviewer_idx" ON "review_decisions" ("reviewer_id");
