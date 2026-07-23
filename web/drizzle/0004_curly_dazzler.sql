ALTER TABLE "events" ADD COLUMN "event_subtype" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "state" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location_precision" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location_rationale" text;
