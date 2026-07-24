# Deploy Runbook — Northern Pakistan Climate Watch

**VPS project path:** `~/docker/apps/climate_awareness/climate_awareness/`
**SSH:** `qalmaq@srv1322288`
**Domain:** `climate-awareness-gbc.qalmaq.cloud`

All commands run from `~/docker/apps/climate_awareness/climate_awareness/` unless stated.
Docker Compose profiles: `app` (web + worker) · `tools` (migrate / seed / admin CLI)

---

## Table of contents

1. [First-time provisioning](#1-first-time-provisioning)
2. [First full deploy](#2-first-full-deploy)
3. [Code deployments (ongoing)](#3-code-deployments-ongoing)
   3b. [Phase 2 deploy — AI verification + Telegram bot + SMS](#3b--phase-2-deploy--ai-verification--telegram-bot--sms)
4. [Admin user management](#4-admin-user-management)
5. [Seed data management](#5-seed-data-management)
6. [Verification commands](#6-verification-commands)
7. [Debug & troubleshooting](#7-debug--troubleshooting)
8. [Backup & restore](#8-backup--restore)
9. [Environment variables reference](#9-environment-variables-reference)
10. [NPM + Cloudflare config](#10-npm--cloudflare-config)

---

## 1 — First-time provisioning

Run once when setting up a new VPS. Skip on subsequent deploys.

```bash
ssh qalmaq@srv1322288

# Confirm Docker + Compose v2
docker --version
docker compose version    # must be v2.x

# Existing services
docker ps
docker network ls

# Create project dir
mkdir -p ~/docker/apps/climate_awareness/climate_awareness
cd ~/docker/apps/climate_awareness/climate_awareness

# Transfer code from local machine (run on LOCAL laptop):
# rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
#   "/Users/jawadhaider/Climate Awareness/" \
#   qalmaq@srv1322288:~/docker/apps/climate_awareness/climate_awareness/

# OR clone from GitHub (once remote exists):
# git clone git@github.com:<user>/climate-awareness.git .
```

### 1.1 — Create `.env`

```bash
cd ~/docker/apps/climate_awareness/climate_awareness

cp .env.example .env
chmod 600 .env

# Generate secrets
POSTGRES_PW=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
NEXTAUTH_SEC=$(openssl rand -base64 32)

sed -i "s|POSTGRES_PASSWORD=changeme|POSTGRES_PASSWORD=${POSTGRES_PW}|" .env
sed -i "s|NEXTAUTH_SECRET=changeme|NEXTAUTH_SECRET=${NEXTAUTH_SEC}|" .env
sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://climate-awareness-gbc.qalmaq.cloud|" .env
sed -i "s|ADMIN_EMAILS=.*|ADMIN_EMAILS=dev.qazxsw@gmail.com|" .env

# Fill in API keys by hand:
nano .env
# Required for RAG:  OPENROUTER_API_KEY=sk-or-...
# Required for embeddings: JINA_API_KEY=jina_...

# Verify
cat .env
```

### 1.2 — Start database and Redis

```bash
docker compose up -d postgres redis

# Wait ~10s for healthchecks
docker compose ps

# Confirm PostGIS
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT PostGIS_Version();"
# Expected: 3.4 USE_GEOS=1 ...
```

---

## 2 — First full deploy

Run after provisioning OR after a database wipe. Order matters.

```bash
cd ~/docker/apps/climate_awareness/climate_awareness

# Step 1: Run all DB migrations
docker compose --profile tools run --rm --build tools pnpm db:migrate

# Step 2: Seed monitored sources (PDMA, ICIMOD, Pamir Times, etc.)
docker compose --profile tools run --rm tools pnpm db:seed

# Step 3: Seed 23 verified historical events (2021–2024)
#   Safe to re-run — skips existing records by source_url+title match
docker compose --profile tools run --rm tools pnpm db:seed-events

# Step 3b: Backfill reviewed coordinates onto the 22 seeded events
#   Sets PostGIS location, precision, rationale; normalises flash_flood types;
#   fixes Kharmang district error; sets state=resolved on all historical events.
#   Safe to re-run — already-correct rows are skipped.
docker compose --profile tools run --rm tools pnpm db:backfill-locations

# Step 4: Verify data
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(*) total, count(embedding_v1) embedded FROM events WHERE status='verified';"
# Expected: total=23, embedded=0  (worker embeds them in ~15 min)

# Step 4b: Verify backfill applied coordinates
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(*) total, count(location) with_location, count(*) filter (where state='resolved') resolved FROM events WHERE status='verified';"
# Expected: total=23 (or 22 if seed-events count differs), with_location=22, resolved=22

# Step 5: Create admin user
docker compose --profile tools run --rm tools \
  pnpm admin:create dev.qazxsw@gmail.com 'YourStrongPassword'

# Step 6: Start web + worker
docker compose --profile app up -d --build web worker

# Step 7: Watch logs
docker compose logs -f web worker
```

**Wait ~15 minutes** for the embedding worker to generate vectors for all seeded events.
Check progress:

```bash
docker compose logs worker | grep embed
# Expected sequence:
#   [embed] Indexing 23 events
#   [embed] Batch 1: 10 events embedded
#   [embed] Batch 2: 10 events embedded
#   [embed] Batch 3: 3 events embedded
#   [embed] Done — 23 events indexed
```

Then verify embeddings complete:

```bash
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(*) total, count(embedding_v1) embedded FROM events WHERE status='verified';"
# Expected: total=23, embedded=23
```

---

## 3 — Code deployments (ongoing)

Run on every push to `main`. Order matters.

```bash
cd ~/docker/apps/climate_awareness/climate_awareness

# 1. Pull latest code
git pull origin main

# 2. Run pending DB migrations
#    --build required: migration SQL is baked into the image
docker compose --profile tools run --rm --build tools pnpm db:migrate

# 3. Re-seed sources if seed-sources.ts changed in this release
#    Safe to re-run — skips existing slugs
docker compose --profile tools run --rm tools pnpm db:seed

# 4. Re-seed events if seed-events.ts changed in this release
#    Safe to re-run — skips existing titles
docker compose --profile tools run --rm tools pnpm db:seed-events

# 4b. Fix broken source URLs on existing events (one-time, idempotent)
#     Run if fix-source-urls.ts changed in this release
docker compose --profile tools build tools
docker compose --profile tools run --rm tools pnpm db:fix-source-urls

# 4c. Backfill reviewed coordinates onto seeded events (P0.2, idempotent)
#     Run if seed-locations.ts or backfill-seed-locations.ts changed in this release
docker compose --profile tools run --rm tools pnpm db:backfill-locations

# 5. Rebuild and restart app containers
docker compose --profile app up -d --build web worker

# 6. Verify
docker compose ps
docker compose logs web   --tail 30
docker compose logs worker --tail 30
```

> **When to run seed steps:** Only run 3 and 4 if the release notes say seed files changed.
> Always safe to run them (idempotent), so when in doubt — run them.

---

## 3b — Phase 2 deploy — AI verification + Telegram bot + SMS

Run this section once when deploying the Phase 2 feature set (`feat(phase2)` commit and later).
All steps are idempotent. Skip steps whose env vars are not yet available.

### Step 1: Apply migration 0008 (AI columns + subscribers + sms_otps)

```bash
cd ~/docker/apps/climate_awareness/climate_awareness

# Rebuild tools image to pick up new migration SQL
docker compose --profile tools run --rm --build tools pnpm db:migrate

# Verify the new columns and tables exist
docker compose exec postgres psql -U climate_gb -d climate_gb -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'alerts' AND column_name IN ('ai_confidence','ai_summary','ai_verified');
"
# Expected: 3 rows

docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('subscribers','sms_otps');"
# Expected: 2 rows
```

### Step 2: Re-seed sources (fixes chitral-times URL, marks pdma-kpk inactive)

```bash
docker compose --profile tools run --rm tools pnpm db:seed
```

### Step 3: Seed 15 new Chitral events

```bash
docker compose --profile tools run --rm tools pnpm db:seed-events
# Expected: 15 new events inserted (Upper + Lower Chitral, 2015–2024)
```

### Step 4: Add new env vars to .env

```bash
nano .env

# Add these lines (fill in real values):
# --- AI verification ---
# OPENROUTER_API_KEY already set from Phase 1 — also used for verify-alerts

# --- Telegram bot ---
# Create bot via BotFather: https://t.me/BotFather → /newbot
# Copy the token (e.g. 7123456789:AAF...) and set a random 32-char secret
TELEGRAM_BOT_TOKEN=
TELEGRAM_SECRET_TOKEN=$(openssl rand -base64 24 | tr -d '/+=')

# --- Twilio SMS (optional — SMS opt-in disabled if not set) ---
# Sign up at https://www.twilio.com → get Account SID, Auth Token, and a phone number
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

Restart to apply:

```bash
docker compose --profile app up -d web worker
```

### Step 5: Register Telegram webhook

Do this once after `TELEGRAM_BOT_TOKEN` is set. Replace `<TOKEN>` and `<SECRET>`:

```bash
BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d= -f2)
SECRET=$(grep TELEGRAM_SECRET_TOKEN .env | cut -d= -f2)
SITE_URL=https://climate-awareness-gbc.qalmaq.cloud

curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${SITE_URL}/api/telegram/webhook" \
  -d "secret_token=${SECRET}" \
  -d "allowed_updates=[\"message\"]"
# Expected: {"ok":true,"result":true,...}
```

Verify the webhook is live:

```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool
# Expected: "url": "https://climate-awareness-gbc.qalmaq.cloud/api/telegram/webhook"
#           "pending_update_count": 0
```

### Step 6: Verify AI verification pipeline

```bash
# Check worker logs for verify-alerts job
docker compose logs worker | grep "\[verify\]"
# Expected within ~5 min of deploy:
#   [verify] Processing N unverified alert(s)
#   [verify] Alert X verified (confidence=NN, isDisaster=true/false)
#   [verify] Done — verified=N, suppressed=M, pushed=P, failed=F

# Check alerts with AI scores in DB
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT id, title, ai_confidence, ai_verified, is_active FROM alerts ORDER BY issued_at DESC LIMIT 10;"

# Check admin UI: https://climate-awareness-gbc.qalmaq.cloud/admin/alerts
# Should show confidence badges (green ≥80, amber 50-79, red <50)
```

### Step 7: Test Telegram bot

Send messages to your bot:

```
/start      → welcome message with all commands
/latest     → last 5 verified events
/alerts     → active alerts for all GB
/alerts Hunza → active alerts for Hunza
/weather    → current weather per district
/ask What GLOF events happened in 2022?  → RAG answer
```

### Step 8: Test SMS opt-in

Visit `https://climate-awareness-gbc.qalmaq.cloud/subscribe` in a browser:

1. Enter a phone number in E.164 format (e.g. `+923001234567`)
2. Select one or more districts
3. Click **Send verification code**
4. Enter the 6-digit code from SMS
5. Confirm subscription

Verify in DB:

```bash
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT phone, districts, active, opt_in_at FROM subscribers ORDER BY opt_in_at DESC LIMIT 5;"
```

---

## 4 — Admin user management

Both conditions must be true for admin login to work:

- User exists in DB
- Email is in `ADMIN_EMAILS` in `.env`

```bash
cd ~/docker/apps/climate_awareness/climate_awareness

# Create or update admin user
docker compose --profile tools run --rm --build tools \
  pnpm admin:create dev.qazxsw@gmail.com 'YourStrongPassword'

# Verify ADMIN_EMAILS is set
grep ADMIN_EMAILS .env

# Fix if wrong
sed -i "s|ADMIN_EMAILS=.*|ADMIN_EMAILS=dev.qazxsw@gmail.com|" .env

# Restart web to pick up .env change
docker compose --profile app up -d web

# Test: visit https://climate-awareness-gbc.qalmaq.cloud/admin/login
```

---

## 5 — Seed data management

### Seed sources (news sources, PDMA, etc.)

```bash
docker compose --profile tools run --rm tools pnpm db:seed
```

Idempotent — skips existing slugs. Add new sources to `web/scripts/seed-sources.ts`, then re-run.

### Seed historical events

```bash
docker compose --profile tools run --rm tools pnpm db:seed-events
```

Idempotent — skips records where `title` already exists.
Add new events to `web/scripts/seed-events.ts`, then re-run.

### Fix broken source URLs on existing events

```bash
docker compose --profile tools build tools
docker compose --profile tools run --rm tools pnpm db:fix-source-urls
```

Idempotent — skips events whose source URL is already correct.
Run after `fix-source-urls.ts` changes or whenever source links need patching.

**After seeding new events, embeddings generate automatically within 15 min.**
Watch the worker:

```bash
docker compose logs -f worker | grep embed
```

### Manually trigger embedding (skip 15-min wait)

```bash
docker compose restart worker
# Worker runs embed job on startup, then every 15 min
docker compose logs -f worker | grep embed
```

---

## 6 — Verification commands

### Container health

```bash
# All containers status
docker compose ps

# Individual health
docker inspect climate_postgres --format '{{.State.Health.Status}}'
docker inspect climate_web      --format '{{.State.Health.Status}}'
```

### Database checks

```bash
# Event counts
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(*) total, count(embedding_v1) embedded FROM events WHERE status='verified';"

# Events by district
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT district, count(*) FROM events WHERE status='verified' GROUP BY district ORDER BY count DESC;"

# Events by type
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT event_type, count(*) FROM events WHERE status='verified' GROUP BY event_type ORDER BY count DESC;"

# Recent events
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT id, title, district, status, embedding_v1 IS NOT NULL AS embedded FROM events ORDER BY created_at DESC LIMIT 10;"

# Sources
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT slug, name, status FROM sources ORDER BY slug;"

# Admin users
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT email, is_admin FROM \"user\" WHERE is_admin = true;"

# Active alerts
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT id, title, level, district, is_active, expires_at FROM alerts ORDER BY issued_at DESC LIMIT 10;"

# RAG query log (last 20 queries)
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT id, doc_count, model_used, duration_ms, blocked, created_at FROM query_logs ORDER BY created_at DESC LIMIT 20;"

# Migrations applied
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;"
```

### API health checks

```bash
# App is up
curl -s -o /dev/null -w "%{http_code}" https://climate-awareness-gbc.qalmaq.cloud/
# Expected: 200

# RAG API — should return SSE stream
curl -s -N -X POST https://climate-awareness-gbc.qalmaq.cloud/api/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What GLOF events happened in Hunza?"}' | head -20
# Expected: data: {"type":"token","content":"..."} lines, then citations, then done

# RAG blocked query test
curl -s -N -X POST https://climate-awareness-gbc.qalmaq.cloud/api/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What is PTI doing about floods?"}' | head -5
# Expected: data: {"type":"blocked","message":"..."}

# Events API
curl -s "https://climate-awareness-gbc.qalmaq.cloud/api/events?limit=5" | head -200

# Rate limit test (21 requests → 21st should be 429)
for i in $(seq 1 21); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://climate-awareness-gbc.qalmaq.cloud/api/agent/query \
    -H "Content-Type: application/json" \
    -d '{"query":"flood"}')
  echo "Request $i: $code"
done
```

### Env var check

```bash
# Verify all required keys are set
grep -E "POSTGRES_PASSWORD|NEXTAUTH_SECRET|NEXTAUTH_URL|ADMIN_EMAILS|OPENROUTER_API_KEY|JINA_API_KEY" .env
```

---

## 7 — Debug & troubleshooting

### RAG citations not showing

```bash
# 1. Check event count
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(*) total, count(embedding_v1) embedded FROM events WHERE status='verified';"

# If total=0 → events not seeded → run §5 seed commands
# If embedded=0 → embeddings missing → check below

# 2. Check JINA_API_KEY
grep JINA_API_KEY .env

# 3. Check worker embed logs
docker compose logs worker | grep -i embed
# "JINA_API_KEY not set — skipping" → key missing in .env → add it, restart worker
# "All verified events are indexed" + embedded=0 → 0 unembedded events (contradicts total)
# "Indexing N events" → actively embedding

# 4. Force embed run
docker compose restart worker
docker compose logs -f worker | grep embed

# 5. Confirm embeddings after worker run
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(embedding_v1) FROM events WHERE status='verified';"
```

**Good questions to test citations (all have seed data):**

- `What GLOF events happened in Hunza?`
- `How many people were affected by floods in Diamer?`
- `Tell me about Nagar valley glacier outbursts`
- `What landslides blocked the Karakoram Highway?`
- `Which districts had critical severity events?`
- `What happened in Astore district floods?`
- `What flash floods damaged infrastructure in Skardu?`

### RAG returns "no relevant events found"

```bash
# Check OPENROUTER_API_KEY
grep OPENROUTER_API_KEY .env

# Test OpenRouter directly
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $(grep OPENROUTER_API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemma-4-26b-a4b-it:free","messages":[{"role":"user","content":"Reply: OK"}],"max_tokens":5}' | grep -o '"content":"[^"]*"'

# Check web logs for errors during RAG call
docker compose logs web --tail 50 | grep -i "error\|embed\|agent"
```

### Web container not starting

```bash
docker compose logs web --tail 50

# Common causes:
# "NEXTAUTH_URL is required" → missing in .env
# "NEXTAUTH_SECRET is required" → missing in .env
# "connect ECONNREFUSED" → postgres not healthy yet

# Check postgres health
docker compose ps postgres
docker compose logs postgres --tail 20
```

### Worker not running

```bash
docker compose ps worker
docker compose logs worker --tail 50

# Restart
docker compose --profile app up -d worker

# Worker job schedule (from logs)
# Startup: alert check → weather refresh + AI verify + embed (parallel)
# Every 15min (at :05/:20/:35/:50): AI verify-alerts
# Every 15min (at :00/:15/:30/:45): embed job
# Hourly (at :00): alert check (ReliefWeb, Pamir Times, GDACS, Chitral Times)
# Every 6h: weather refresh
# Daily 03:00: cleanup (old query_logs, expired sms_otps)
```

### AI verification not running

```bash
# Check OPENROUTER_API_KEY is set (used for both RAG and AI verification)
grep OPENROUTER_API_KEY .env

# Watch verify-alerts logs
docker compose logs worker | grep "\[verify\]"
# "[verify] OPENROUTER_API_KEY not set" → add key, restart worker
# "[verify] No unverified alerts — nothing to do" → all alerts already processed
# "[verify] N failed" → OpenRouter API error; check API key validity

# Test OpenRouter models directly
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $(grep OPENROUTER_API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemma-4-26b-a4b-it:free","messages":[{"role":"user","content":"Reply: OK"}],"max_tokens":5}' \
  | grep -o '"content":"[^"]*"'
# Expected: "content":"OK"

# Force immediate verify run by restarting worker
docker compose restart worker
docker compose logs -f worker | grep "\[verify\]"
```

### Telegram bot not responding

```bash
# Verify webhook is registered
BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d= -f2)
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool

# Check web logs for incoming webhook calls
docker compose logs web --tail 50 | grep "telegram"

# Re-register webhook if URL is wrong
SECRET=$(grep TELEGRAM_SECRET_TOKEN .env | cut -d= -f2)
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://climate-awareness-gbc.qalmaq.cloud/api/telegram/webhook" \
  -d "secret_token=${SECRET}" \
  -d "allowed_updates=[\"message\"]"
```

### Database connection issues

```bash
# Test connection from web container
docker compose exec web wget -qO- http://localhost:3000/api/events?limit=1

# Test direct DB connection
docker compose exec postgres psql -U climate_gb -d climate_gb -c "\conninfo"

# Check pg_data volume is intact
docker volume inspect climate_awareness_pg_data
```

### Migrations failed

```bash
# Check migration state
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;"

# Re-run migration (idempotent if files use IF NOT EXISTS)
docker compose --profile tools run --rm --build tools pnpm db:migrate

# If migration table doesn't exist (fresh DB):
docker compose --profile tools run --rm --build tools pnpm db:migrate
# Drizzle creates __drizzle_migrations automatically on first run
```

### Container logs shortcuts

```bash
# All logs
docker compose logs -f

# Specific containers
docker compose logs -f web
docker compose logs -f worker
docker compose logs -f postgres

# Last N lines
docker compose logs web --tail 100
docker compose logs worker --tail 100

# Errors only
docker compose logs web 2>&1 | grep -i error
docker compose logs worker 2>&1 | grep -i error
```

### Disk and resource check

```bash
# Disk usage
df -h
docker system df

# Container resource usage
docker stats --no-stream

# Volume sizes
docker system df -v | grep climate
```

---

## 8 — Backup & restore

### Manual backup (run anytime)

```bash
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
DUMP=~/backups/climate_gb_${STAMP}.sql.gz
mkdir -p ~/backups

docker compose exec -T postgres \
  pg_dump -U climate_gb -d climate_gb --format=plain --no-owner \
  | gzip > "$DUMP"

echo "Backup: $DUMP ($(du -sh $DUMP | cut -f1))"
```

### Automated nightly backup (`bin/pg-backup.sh`)

```bash
# Make executable
chmod +x bin/pg-backup.sh

# Test manually
./bin/pg-backup.sh

# Install cron: 03:15 UTC daily
( crontab -l 2>/dev/null; \
  echo "15 3 * * * ~/docker/apps/climate_awareness/climate_awareness/bin/pg-backup.sh >> /var/log/climate-backup.log 2>&1" \
) | crontab -

crontab -l
```

### Restore from backup

```bash
# Stop web/worker (keep postgres running)
docker compose --profile app stop web worker

# Restore
gunzip -c ~/backups/climate_gb_<STAMP>.sql.gz | \
  docker compose exec -T postgres psql -U climate_gb -d climate_gb

# Restart
docker compose --profile app up -d web worker

# Verify
docker compose exec postgres psql -U climate_gb -d climate_gb \
  -c "SELECT count(*) FROM events;"
```

> **Never run `docker compose down -v`** after real data exists. `-v` destroys `pg_data`.

---

## 9 — Environment variables reference

All vars live in `.env` at project root. Mode 600.

| Variable                | Required   | Default      | Notes                                                                             |
| ----------------------- | ---------- | ------------ | --------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`     | ✅         | —            | Generate: `openssl rand -base64 32`                                               |
| `NEXTAUTH_URL`          | ✅         | —            | `https://climate-awareness-gbc.qalmaq.cloud`                                      |
| `NEXTAUTH_SECRET`       | ✅         | —            | Generate: `openssl rand -base64 32`                                               |
| `AUTH_SECRET`           | auto       | —            | Set by compose from `NEXTAUTH_SECRET`. Do not set manually.                       |
| `ADMIN_EMAILS`          | ✅         | —            | `dev.qazxsw@gmail.com` (comma-separated for multiple)                             |
| `OPENROUTER_API_KEY`    | ✅ RAG+AI  | —            | Free tier. Used for RAG (LLM answers) and AI alert verification (verify-alerts).  |
| `JINA_API_KEY`          | ✅ RAG     | —            | Free 1M tokens/day. Embeddings disabled without this — citations will not appear. |
| `TELEGRAM_BOT_TOKEN`    | ✅ Phase 2 | —            | From BotFather (`/newbot`). Telegram commands + subscriber push disabled without. |
| `TELEGRAM_SECRET_TOKEN` | ✅ Phase 2 | —            | Random secret validating webhook calls. Generate: `openssl rand -base64 24`       |
| `TWILIO_ACCOUNT_SID`    | optional   | —            | Twilio account SID (`ACxxx...`). SMS opt-in disabled if not set.                  |
| `TWILIO_AUTH_TOKEN`     | optional   | —            | Twilio auth token. Required with SID.                                             |
| `TWILIO_FROM_NUMBER`    | optional   | —            | E.164 Twilio number (e.g. `+12065551234`). Required with SID.                     |
| `POSTGRES_DB`           | ✗          | `climate_gb` |                                                                                   |
| `POSTGRES_USER`         | ✗          | `climate_gb` |                                                                                   |
| `BLOCKED_IPS`           | ✗          | —            | Comma-separated IPs blocked at middleware                                         |
| `AGENT_RATE_LIMIT`      | ✗          | `20`         | Max RAG questions per IP per day                                                  |

### Update a var after first deploy

```bash
nano .env                         # edit
docker compose --profile app up -d web worker   # restart to apply
```

---

## 10 — NPM + Cloudflare config

### Nginx Proxy Manager

Proxy Host settings:

- Domain: `climate-awareness-gbc.qalmaq.cloud`
- Forward: `climate_web:3000` (container must be on `climate_net`)
- SSL: Let's Encrypt, Force SSL on

```bash
# Attach NPM container to climate_net (one-time)
docker network connect climate_net <npm-container-name>
```

Advanced tab nginx snippet (required for real-IP and rate limiting):

```nginx
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;

location ~ ^/(admin|api)/ {
  add_header Cache-Control "no-store";
}
```

Without the `set_real_ip_from` block, `BLOCKED_IPS` and rate limiting see Cloudflare IPs, not real visitor IPs.

### Cloudflare

- A record: `climate-awareness-gbc.qalmaq.cloud` → VPS public IP, **Proxied**
- SSL/TLS mode: **Full (strict)**
- Page rules:
  - `*/api/*` → Cache Level: Bypass
  - `*/admin/*` → Cache Level: Bypass
