/**
 * AI alert verification job.
 *
 * Picks unprocessed alerts (ai_verified = false), sends each to OpenRouter
 * for structured disaster analysis, and writes back:
 *   - ai_confidence (0–100): LLM certainty this is a real regional disaster
 *   - ai_summary: 1–2 sentence reasoning
 *   - district: extracted district name (if not already set in the row)
 *   - ai_verified = true: marks the row as "AI-processed" regardless of score
 *   - is_active = false: set when LLM classifies the item as non-disaster
 *
 * Confidence gates:
 *   >= 80  → pushNotify() is called; alert stays active
 *   50–79  → stays active but stays in admin review queue (unacted)
 *   < 50   → is_active set to false (suppressed from public view)
 *
 * Runs every 15 minutes via cron in index.ts.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { pushNotify, type AlertForPush } from './push-notify.js';
import { createLogger } from '../logger.js';

const logger = createLogger('verify');

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
] as const;

const NOTIFY_THRESHOLD = 80;
const SUPPRESS_THRESHOLD = 50;
const MAX_PER_RUN = 20;
const REQUEST_TIMEOUT_MS = 30_000;

// Valid district names — must match GB_DISTRICTS in web/src/lib/constants.ts
const VALID_DISTRICTS = new Set([
  'Gilgit',
  'Hunza',
  'Nagar',
  'Ghizer',
  'Astore',
  'Diamer',
  'Shigar',
  'Skardu',
  'Ghanche',
  'Kharmang',
  'Upper Chitral',
  'Lower Chitral',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertRow {
  id: number;
  title: string;
  body: string;
  level: string;
  district: string | null;
  sourceUrl: string | null;
}

interface VerificationResult {
  isDisaster: boolean;
  district: string | null;
  eventType: string;
  severity: string;
  affectedCount: number | null;
  confidence: number;
  reasoning: string;
}

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterChoice {
  message: { content: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: { message: string };
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a disaster event verifier for Northern Pakistan Climate Watch — a platform that tracks verified GLOF events, flash floods, landslides, and extreme weather in Gilgit-Baltistan and Chitral.

Analyze the news item provided and return ONLY a valid JSON object. No markdown, no explanation, no code fences — just the JSON.

Required JSON structure:
{
  "isDisaster": boolean,
  "district": string or null,
  "eventType": "glof" | "flood" | "landslide" | "weather" | "earthquake" | "general",
  "severity": "low" | "moderate" | "high" | "critical",
  "affectedCount": number or null,
  "confidence": integer 0-100,
  "reasoning": string
}

Field rules:
- isDisaster: true ONLY for real disaster events (GLOF, flood, landslide, earthquake, infrastructure damage, casualties, displacement, evacuation). False for political news, sports, economy, elections.
- district: MUST be one of exactly: Gilgit, Hunza, Nagar, Ghizer, Astore, Diamer, Shigar, Skardu, Ghanche, Kharmang, Upper Chitral, Lower Chitral — or null if not clearly mentioned.
- affectedCount: total people affected/displaced/killed/injured combined, or null.
- confidence: 0-49 = non-disaster or unrelated; 50-79 = likely disaster but uncertain; 80-100 = clear verified Northern Pakistan disaster.
- reasoning: 1-2 sentences maximum explaining your confidence score.`;
}

async function callOpenRouter(
  title: string,
  body: string,
  apiKey: string,
  siteUrl: string,
): Promise<VerificationResult | null> {
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: `Analyze this alert:\n\nTitle: ${title.slice(0, 300)}\n\nBody: ${body.slice(0, 1200)}`,
    },
  ];

  for (const model of MODELS) {
    try {
      const res = await fetch(OPENROUTER_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': siteUrl,
          'X-Title': 'Northern Pakistan Climate Watch',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.warn(`${model} HTTP ${res.status}`, { body: text.slice(0, 200) });
        continue;
      }

      const json = (await res.json()) as OpenRouterResponse;

      if (json.error) {
        logger.warn(`${model} API error`, { message: json.error.message });
        continue;
      }

      const content = json.choices?.[0]?.message?.content ?? '';
      if (!content) {
        logger.warn(`${model} returned empty content`);
        continue;
      }

      const parsed = JSON.parse(content) as VerificationResult;

      // Sanitise: clamp confidence, validate district, coerce types
      const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
      const district =
        typeof parsed.district === 'string' && VALID_DISTRICTS.has(parsed.district)
          ? parsed.district
          : null;
      const affectedCount =
        typeof parsed.affectedCount === 'number' && parsed.affectedCount >= 0
          ? Math.round(parsed.affectedCount)
          : null;

      // Validate enum fields — reject arbitrary LLM strings
      const VALID_EVENT_TYPES = new Set([
        'glof',
        'flood',
        'landslide',
        'weather',
        'earthquake',
        'general',
      ]);
      const VALID_SEVERITIES = new Set(['low', 'moderate', 'high', 'critical']);
      const eventType =
        typeof parsed.eventType === 'string' && VALID_EVENT_TYPES.has(parsed.eventType)
          ? parsed.eventType
          : 'general';
      const severity =
        typeof parsed.severity === 'string' && VALID_SEVERITIES.has(parsed.severity)
          ? parsed.severity
          : 'moderate';

      const reasoning =
        typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
          ? parsed.reasoning.slice(0, 500)
          : `Model returned no reasoning (confidence=${confidence})`;

      return {
        isDisaster: Boolean(parsed.isDisaster),
        district,
        eventType,
        severity,
        affectedCount,
        confidence,
        reasoning,
      };
    } catch (err) {
      // JSON parse errors or network errors — try next model
      logger.warn(`${model} failed`, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  return null; // all models exhausted
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchUnverified(): Promise<AlertRow[]> {
  const result = await db
    .execute(
      sql`
    SELECT id, title, body, level, district, source_url
    FROM   alerts
    WHERE  ai_verified = false
      AND  is_active   = true
    ORDER  BY issued_at DESC
    LIMIT  ${MAX_PER_RUN}
  `,
    )
    .catch((err: unknown) => {
      logger.error('Failed to fetch unverified alerts', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

  if (!result) return [];

  return result.rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    body: r.body as string,
    level: r.level as string,
    district: (r.district as string | null) ?? null,
    sourceUrl: (r.source_url as string | null) ?? null,
  }));
}

async function applyVerificationResult(
  alertId: number,
  result: VerificationResult,
  existingDistrict: string | null,
): Promise<void> {
  // Only overwrite district if the existing value is null — AI supplements, not overrides
  const districtUpdate =
    existingDistrict === null && result.district !== null
      ? sql`, district = ${result.district}`
      : sql``;

  // Suppress non-disaster noise; keep is_active for disaster items
  const isActiveUpdate = result.isDisaster ? sql`` : sql`, is_active = false`;

  await db.execute(sql`
    UPDATE alerts
    SET    ai_confidence = ${result.confidence},
           ai_summary    = ${result.reasoning},
           ai_verified   = true
           ${districtUpdate}
           ${isActiveUpdate}
    WHERE  id = ${alertId}
  `);
}

async function applyFailedVerification(alertId: number): Promise<void> {
  // Mark as processed with confidence=0 so it doesn't block future runs
  await db
    .execute(
      sql`
      UPDATE alerts
      SET    ai_verified   = true,
             ai_confidence = 0,
             ai_summary    = 'AI verification failed — all models returned errors.'
      WHERE  id = ${alertId}
    `,
    )
    .catch((err: unknown) => {
      logger.error('Failed to mark alert as failed-verification', {
        alertId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function verifyAlerts(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.info('OPENROUTER_API_KEY not set — skipping AI verification');
    return;
  }

  const siteUrl = process.env.NEXTAUTH_URL ?? 'https://climate-awareness-gbc.qalmaq.cloud';

  const unverified = await fetchUnverified();

  if (unverified.length === 0) {
    logger.debug('No unverified alerts');
    // Still check for admin-flagged notifications even when nothing needs AI verification
    await dispatchAdminVerifiedNotifications();
    return;
  }

  logger.info(`Processing unverified alerts`, { count: unverified.length });

  let verified = 0;
  let suppressed = 0;
  let pushed = 0;
  let failed = 0;

  for (const alert of unverified) {
    try {
      const result = await callOpenRouter(alert.title, alert.body, apiKey, siteUrl);

      if (!result) {
        await applyFailedVerification(alert.id);
        failed++;
        continue;
      }

      await applyVerificationResult(alert.id, result, alert.district);

      if (result.confidence < SUPPRESS_THRESHOLD) {
        suppressed++;
        logger.info('Alert suppressed', {
          alertId: alert.id,
          confidence: result.confidence,
          reasoning: result.reasoning,
        });
      } else {
        verified++;

        if (result.isDisaster && result.confidence >= NOTIFY_THRESHOLD) {
          const alertForPush: AlertForPush = {
            id: alert.id,
            title: alert.title,
            body: alert.body,
            level: alert.level,
            district: result.district ?? alert.district,
            sourceUrl: alert.sourceUrl,
            aiConfidence: result.confidence,
          };

          await pushNotify(alertForPush).catch((err: unknown) =>
            logger.error('pushNotify failed', {
              alertId: alert.id,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          pushed++;
        }

        logger.info('Alert verified', {
          alertId: alert.id,
          confidence: result.confidence,
          isDisaster: result.isDisaster,
        });
      }
    } catch (err) {
      logger.error('Unexpected error processing alert', {
        alertId: alert.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await applyFailedVerification(alert.id);
      failed++;
    }
  }

  logger.info('Verification run complete', { verified, suppressed, pushed, failed });

  // Dispatch push notifications for admin-verified alerts (set by override route)
  await dispatchAdminVerifiedNotifications();
}

async function dispatchAdminVerifiedNotifications(): Promise<void> {
  const result = await db
    .execute(
      sql`
    SELECT id, title, body, level, district, source_url, ai_confidence
    FROM   alerts
    WHERE  needs_push_notify = true
      AND  is_active         = true
    LIMIT  50
  `,
    )
    .catch(() => null);

  if (!result || result.rows.length === 0) return;

  logger.info('Dispatching push for admin-verified alerts', { count: result.rows.length });

  for (const row of result.rows) {
    const alertId = row.id as number;
    const alertForPush: AlertForPush = {
      id: alertId,
      title: row.title as string,
      body: row.body as string,
      level: row.level as string,
      district: (row.district as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      aiConfidence: (row.ai_confidence as number | null) ?? 100,
    };

    await pushNotify(alertForPush).catch((err: unknown) =>
      logger.error('pushNotify failed for admin-verified alert', {
        alertId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    // Clear the flag regardless of push success to avoid repeated attempts
    await db
      .execute(sql`UPDATE alerts SET needs_push_notify = false WHERE id = ${alertId}`)
      .catch((err: unknown) =>
        logger.error('Failed to clear needs_push_notify flag', {
          alertId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
  }
}
