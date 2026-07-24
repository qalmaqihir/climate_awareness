-- Phase 2.F: AI verification columns on alerts and events.
-- Phase 2.B/2.D: subscribers and sms_otps tables for push notifications.
-- All statements are idempotent (IF NOT EXISTS guards).

--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "ai_confidence" smallint;
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "ai_summary" text;
--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "ai_verified" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_ai_verified_idx" ON "alerts" ("ai_verified");

--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ai_confidence" smallint;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ai_summary" text;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscribers" (
  "id"                integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "phone"             text UNIQUE,
  "telegram_chat_id"  bigint UNIQUE,
  "districts"         text[] NOT NULL DEFAULT '{}',
  "language"          text NOT NULL DEFAULT 'en',
  "active"            boolean NOT NULL DEFAULT true,
  "opt_in_at"         timestamptz NOT NULL DEFAULT now(),
  "opt_out_at"        timestamptz,
  CONSTRAINT "subscribers_has_contact"
    CHECK (phone IS NOT NULL OR telegram_chat_id IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscribers_active_idx"
  ON "subscribers" ("active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscribers_districts_gin_idx"
  ON "subscribers" USING GIN ("districts");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_otps" (
  "phone"      text PRIMARY KEY,
  "code"       text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
