CREATE TABLE "query_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "query_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"query_hash" text NOT NULL,
	"ip_hash" text NOT NULL,
	"doc_count" integer,
	"model_used" text,
	"duration_ms" integer,
	"blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "embedding_v1" vector(1024);
