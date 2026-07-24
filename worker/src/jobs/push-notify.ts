/**
 * Push notification dispatcher.
 *
 * Called by verify-alerts.ts after an alert reaches confidence >= 80.
 * Dispatches to:
 *   1. Telegram subscribers (Bot API sendMessage)
 *   2. SMS subscribers (Twilio Messages API)
 *
 * Gracefully no-ops when env vars are absent (allows safe local dev).
 * Failed sends are logged but never rethrow — a notification failure must
 * not block the verification pipeline.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { createLogger } from '../logger.js';

const logger = createLogger('push');

export interface AlertForPush {
  id: number;
  title: string;
  body: string;
  level: string;
  district: string | null;
  sourceUrl: string | null;
  aiConfidence: number;
}

interface SubscriberRow {
  phone: string | null;
  telegramChatId: number | null;
  language: string;
}

const TELEGRAM_API = 'https://api.telegram.org/bot';
const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';
const REQUEST_TIMEOUT_MS = 10_000;

// Telegram Bot API limit: 30 messages/second (we use conservative 25/s)
const TELEGRAM_BATCH_DELAY_MS = 40;

// ─── Subscriber lookup ────────────────────────────────────────────────────────

// Maximum subscribers fetched per notification — prevents OOM on large tables.
// At 1 SMS/s and 1k subscribers this runs for ~17 min which is the real scale limit.
const SUBSCRIBER_FETCH_LIMIT = 1_000;

async function findSubscribers(district: string | null): Promise<SubscriberRow[]> {
  // When district is null, notify all active subscribers (GB-wide alert)
  const query = district
    ? db.execute(sql`
        SELECT phone, telegram_chat_id, language
        FROM   subscribers
        WHERE  active = true
          AND  (
            districts = '{}'::text[]     -- empty array = subscribed to all regions
            OR ${district} = ANY(districts)
          )
        LIMIT ${SUBSCRIBER_FETCH_LIMIT}
      `)
    : db.execute(sql`
        SELECT phone, telegram_chat_id, language
        FROM   subscribers
        WHERE  active = true
        LIMIT ${SUBSCRIBER_FETCH_LIMIT}
      `);

  const result = await query.catch((err: unknown) => {
    logger.error('Failed to fetch subscribers', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });

  if (!result) return [];

  return result.rows.map((r) => ({
    phone: (r.phone as string | null) ?? null,
    telegramChatId: (r.telegram_chat_id as number | null) ?? null,
    language: (r.language as string) || 'en',
  }));
}

// ─── Message formatting ───────────────────────────────────────────────────────

const LEVEL_EMOJI: Record<string, string> = {
  emergency: '🚨',
  warning: '⚠️',
  watch: '👁️',
  advisory: 'ℹ️',
};

function formatTelegramMessage(alert: AlertForPush): string {
  const emoji = LEVEL_EMOJI[alert.level] ?? '📢';
  const region = alert.district ?? 'Northern Pakistan';
  const preview = alert.body.slice(0, 280).replace(/\n+/g, ' ').trim();
  const sourceLink = alert.sourceUrl ? `\n🔗 <a href="${alert.sourceUrl}">Source</a>` : '';

  return (
    `${emoji} <b>${alert.level.toUpperCase()} ALERT — ${region}</b>\n\n` +
    `${alert.title}\n\n` +
    `${preview}${preview.length < alert.body.length ? '…' : ''}` +
    sourceLink +
    `\n\n<i>AI confidence: ${alert.aiConfidence}%</i>` +
    `\n/unsubscribe to stop alerts`
  );
}

function formatSmsMessage(alert: AlertForPush): string {
  const region = alert.district ?? 'N.Pakistan';
  const level = alert.level.toUpperCase();
  const truncatedTitle = alert.title.slice(0, 100);
  const url = alert.sourceUrl ?? 'https://climate-awareness-gbc.qalmaq.cloud';

  // SMS max 160 chars for single segment; keep under 155 for headroom
  const base = `${level} NPCW ALERT (${region}): ${truncatedTitle}. ${url}. Reply STOP to opt-out`;
  return base.slice(0, 155);
}

// ─── Telegram send ─────────────────────────────────────────────────────────────

async function sendTelegramMessage(chatId: number, text: string, botToken: string): Promise<void> {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function dispatchTelegram(
  subscribers: SubscriberRow[],
  alert: AlertForPush,
  botToken: string,
): Promise<{ sent: number; failed: number }> {
  const message = formatTelegramMessage(alert);
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    if (!sub.telegramChatId) continue;

    try {
      await sendTelegramMessage(sub.telegramChatId, message, botToken);
      sent++;
    } catch (err) {
      logger.error('Telegram send failed', {
        chatId: sub.telegramChatId,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }

    // Respect Telegram rate limit
    await new Promise((r) => setTimeout(r, TELEGRAM_BATCH_DELAY_MS));
  }

  return { sent, failed };
}

// ─── Twilio SMS send ──────────────────────────────────────────────────────────

async function sendSms(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<void> {
  const url = `${TWILIO_API}/${accountSid}/Messages.json`;

  const formData = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: body,
  });

  // Twilio uses HTTP Basic auth: accountSid:authToken
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: formData.toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Twilio HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function dispatchSms(
  subscribers: SubscriberRow[],
  alert: AlertForPush,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<{ sent: number; failed: number }> {
  const message = formatSmsMessage(alert);
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    if (!sub.phone) continue;

    try {
      await sendSms(sub.phone, message, accountSid, authToken, fromNumber);
      sent++;
    } catch (err) {
      logger.error('SMS send failed', {
        phone: sub.phone.slice(0, 6) + '***',
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }

    // Conservative pacing: 1 SMS per second to stay within Twilio defaults
    await new Promise((r) => setTimeout(r, 1_000));
  }

  return { sent, failed };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function pushNotify(alert: AlertForPush): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const twAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twFromNumber = process.env.TWILIO_FROM_NUMBER;

  const hasTelegram = Boolean(botToken);
  const hasTwilio = Boolean(twAccountSid && twAuthToken && twFromNumber);

  if (!hasTelegram && !hasTwilio) {
    logger.info('No notification channels configured (TELEGRAM_BOT_TOKEN / TWILIO_* not set)');
    return;
  }

  const subscribers = await findSubscribers(alert.district);

  if (subscribers.length === 0) {
    logger.info('No subscribers to notify', { alertId: alert.id });
    return;
  }

  logger.info('Notifying subscribers', {
    alertId: alert.id,
    title: alert.title.slice(0, 60),
    count: subscribers.length,
  });

  // Filter at dispatch time: avoid passing irrelevant rows to each channel
  const telegramSubs = hasTelegram ? subscribers.filter((s) => s.telegramChatId !== null) : [];
  const smsSubs = hasTwilio ? subscribers.filter((s) => s.phone !== null) : [];

  const results = await Promise.allSettled([
    telegramSubs.length > 0
      ? dispatchTelegram(telegramSubs, alert, botToken!)
      : Promise.resolve({ sent: 0, failed: 0 }),

    smsSubs.length > 0
      ? dispatchSms(smsSubs, alert, twAccountSid!, twAuthToken!, twFromNumber!)
      : Promise.resolve({ sent: 0, failed: 0 }),
  ]);

  const [tgResult, smsResult] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { sent: 0, failed: 1 },
  );

  logger.info('Push dispatch complete', {
    alertId: alert.id,
    telegram: tgResult,
    sms: smsResult,
  });
}
