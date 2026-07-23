-- Run once on first container boot (docker-entrypoint-initdb.d).
-- Idempotent so re-runs on volume recreation are safe.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
