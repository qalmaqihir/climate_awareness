-- Weather snapshots are ephemeral (48h TTL). Delete all rows so the text→real
-- column changes below succeed without needing USING casts on potentially empty strings.
DELETE FROM "weather_snapshots";--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "latitude" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "longitude" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "temperature_celsius" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "precipitation_mm" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ALTER COLUMN "windspeed_kmh" SET DATA TYPE real;
