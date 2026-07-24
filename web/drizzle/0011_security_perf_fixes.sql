-- Security and performance fixes (Phase 2.F hardening)
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS guards.

--> statement-breakpoint
-- OTP brute-force protection: track failed attempts per code
ALTER TABLE "sms_otps" ADD COLUMN IF NOT EXISTS "attempt_count" smallint NOT NULL DEFAULT 0;

--> statement-breakpoint
-- Store validated districts at subscribe time so /verify cannot override them
ALTER TABLE "sms_otps" ADD COLUMN IF NOT EXISTS "districts" text[] NOT NULL DEFAULT '{}';

--> statement-breakpoint
-- Flag for admin-verified alerts that still need push notifications dispatched
-- Set by /api/admin/alerts/[id]/override when action='verify'; cleared by worker after dispatch.
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "needs_push_notify" boolean NOT NULL DEFAULT false;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_needs_push_idx"
  ON "alerts" ("needs_push_notify")
  WHERE "needs_push_notify" = true;

--> statement-breakpoint
-- Composite partial index: alert verification job (ai_verified=false, is_active=true, order by issued_at)
CREATE INDEX IF NOT EXISTS "alerts_unverified_active_idx"
  ON "alerts" ("ai_verified", "is_active", "issued_at" DESC)
  WHERE "ai_verified" = false AND "is_active" = true;

--> statement-breakpoint
-- Partial index on subscribers: fast push-notify lookup (WHERE active = true)
CREATE INDEX IF NOT EXISTS "subscribers_active_covering_idx"
  ON "subscribers" ("id", "phone", "telegram_chat_id", "language")
  WHERE "active" = true;
