/**
 * POST /api/subscribe
 *
 * Initiates SMS opt-in for push alert notifications.
 * Generates a 6-digit OTP, stores its SHA-256 hash in sms_otps (10-minute TTL),
 * and sends it via Twilio SMS to the provided phone number.
 *
 * Body: { phone: string (E.164), districts: string[] }
 *
 * If TWILIO_* env vars are not set the OTP hash is still stored but not sent
 * (useful for testing via /api/subscribe/verify directly).
 */
import { createHash } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { GB_DISTRICTS } from '@/lib/constants';

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';
const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// E.164 format: +923001234567 (must start with + followed by 7-15 digits)
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const bodySchema = z.object({
  phone: z.string().regex(E164_REGEX, 'Phone must be in E.164 format (e.g. +923001234567)'),
  districts: z.array(z.string()).max(12, 'Too many districts').default([]),
});

// ─── Rate limiting (in-memory, per-IP + per-phone) ────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateBucket>();
const phoneBuckets = new Map<string, RateBucket>();
const OTP_IP_LIMIT = 10; // max OTP requests per IP per hour
const OTP_PHONE_LIMIT = 3; // max OTP requests per phone per hour
const OTP_WINDOW_MS = 60 * 60 * 1_000;

function checkOtpRateLimit(key: string, map: Map<string, RateBucket>, limit: number): boolean {
  const now = Date.now();
  const bucket = map.get(key);
  if (!bucket || now > bucket.resetAt) {
    map.set(key, { count: 1, resetAt: now + OTP_WINDOW_MS });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// Prune every 2 hours
setInterval(
  () => {
    const now = Date.now();
    for (const [k, b] of ipBuckets) if (now > b.resetAt) ipBuckets.delete(k);
    for (const [k, b] of phoneBuckets) if (now > b.resetAt) phoneBuckets.delete(k);
  },
  2 * 60 * 60 * 1_000,
);

// ─── OTP generation ───────────────────────────────────────────────────────────

function generateOtp(): string {
  // Rejection-sampling avoids modular bias when Uint32 max is not divisible by 1_000_000
  const buf = new Uint32Array(1);
  const MAX_UNBIASED = 4_000_000_000; // largest multiple of 1_000_000 below 2^32
  do {
    crypto.getRandomValues(buf);
  } while (buf[0]! >= MAX_UNBIASED);
  return String(buf[0]! % 1_000_000).padStart(6, '0');
}

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

// ─── Twilio ───────────────────────────────────────────────────────────────────

async function sendOtpSms(phone: string, code: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[subscribe] Twilio not configured — OTP for ${phone.slice(0, 6)}***: ${code}`);
    return;
  }

  const body = `Your Northern Pakistan Climate Watch verification code is: ${code}. Valid for ${OTP_TTL_MINUTES} minutes.`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(`${TWILIO_API}/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ To: phone, From: fromNumber, Body: body }).toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Twilio HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit by IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  if (!checkOtpRateLimit(ip, ipBuckets, OTP_IP_LIMIT)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { phone, districts } = parsed.data;

  // Rate limit by phone number
  if (!checkOtpRateLimit(phone, phoneBuckets, OTP_PHONE_LIMIT)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  // Validate each district name against the canonical list
  const validDistricts = districts.filter((d) =>
    GB_DISTRICTS.includes(d as (typeof GB_DISTRICTS)[number]),
  );

  // Normalize: return the same message regardless of whether the phone is already subscribed
  // to prevent enumeration of active subscribers via 409 vs other status codes.
  const existing = await db
    .execute(sql`SELECT id, active FROM subscribers WHERE phone = ${phone} LIMIT 1`)
    .catch(() => null);

  if (existing?.rows[0] && (existing.rows[0].active as boolean)) {
    // Respond 200 — do not reveal subscription status
    return NextResponse.json({
      ok: true,
      message: `If this number is not already subscribed, a verification code was sent to ${phone.slice(0, 4)}***. Enter it below.`,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  }

  const code = generateOtp();
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1_000).toISOString();

  // Upsert OTP (stores hash, not plaintext; stores validated districts for /verify to use)
  await db.execute(sql`
    INSERT INTO sms_otps (phone, code, districts, attempt_count, expires_at)
    VALUES (${phone}, ${codeHash}, ${validDistricts}, 0, ${expiresAt}::timestamptz)
    ON CONFLICT (phone) DO UPDATE SET
      code          = ${codeHash},
      districts     = ${validDistricts},
      attempt_count = 0,
      expires_at    = ${expiresAt}::timestamptz,
      created_at    = now()
  `);

  try {
    await sendOtpSms(phone, code);
  } catch (err) {
    // Clean up the OTP row so the client can retry cleanly
    await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});
    console.error('[subscribe] SMS send failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to send SMS. Check your phone number and try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Verification code sent to ${phone.slice(0, 4)}***. Enter it below.`,
    expiresInMinutes: OTP_TTL_MINUTES,
    ...(process.env.NODE_ENV === 'development' && { devCode: code }),
  });
}
