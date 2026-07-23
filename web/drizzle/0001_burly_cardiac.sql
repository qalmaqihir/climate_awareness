-- Weather snapshots are ephemeral (48h TTL). Delete all rows before the type changes.
-- text→real requires an explicit USING cast in Postgres regardless of row count.
DELETE FROM "weather_snapshots";--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "latitude" SET DATA TYPE real USING latitude::real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "longitude" SET DATA TYPE real USING longitude::real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "temperature_celsius" SET DATA TYPE real USING temperature_celsius::real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "precipitation_mm" SET DATA TYPE real USING precipitation_mm::real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "windspeed_kmh" SET DATA TYPE real USING windspeed_kmh::real;
