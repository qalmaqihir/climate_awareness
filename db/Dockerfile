# Extends the official PostGIS image with pgvector for Phase 2.A RAG search.
# Both extensions are registered in db/init/00-extensions.sql on first boot.
FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
