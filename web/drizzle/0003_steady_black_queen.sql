CREATE INDEX "alerts_source_url_idx" ON "alerts" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "events_status_reported_at_idx" ON "events" USING btree ("status","reported_at");--> statement-breakpoint
CREATE INDEX "query_logs_created_at_idx" ON "query_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "weather_snapshots_district_fetched_idx" ON "weather_snapshots" USING btree ("district","fetched_at");
