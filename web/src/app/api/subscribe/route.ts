/**
 * POST /api/subscribe
 *
 * Initiates SMS opt-in for push alert notifications.
 * Generates a 6-digit OTP, stores it in sms_otps (10-minute TTL),
 * and sends it via Twilio SMS to the provided phone number.
 *
 * Body: { phone: string (E.164), districts: string[] }
 *
 * If TWILIO_* env vars are not set the OTP is still stored but not sent
 * (useful for testing via /api/subscribe/verify directly).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { GB_DISTRICTS } from '@/lib/constants';

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';
const OTP_TTL_MINUTES = 10;

// E.164 format: +923001234567 (must start with + followed by 7-15 digits)
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const bodySchema = z.object({
  phone: z.string().regex(E164_REGEX, 'Phone must be in E.164 format (e.g. +923001234567)'),
  districts: z.array(z.string()).max(12, 'Too many districts').default([]),
});

function generateOtp(): string {
  // Cryptographically random 6-digit code
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(buffer[0]! % 1_000_000).padStart(6, '0');
}

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

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  // Validate each district name against the canonical list
  const validDistricts = districts.filter((d) =>
    GB_DISTRICTS.includes(d as (typeof GB_DISTRICTS)[number]),
  );

  // Check if already subscribed and active
  const existing = await db
    .execute(
      sql`
    SELECT id, active FROM subscribers WHERE phone = ${phone} LIMIT 1
  `,
    )
    .catch(() => null);

  if (existing?.rows[0] && (existing.rows[0].active as boolean)) {
    return NextResponse.json(
      { error: 'This number is already subscribed. Text STOP to unsubscribe.' },
      { status: 409 },
    );
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1_000).toISOString();

  // Upsert OTP (replace existing code if phone re-requests)
  await db.execute(sql`
    INSERT INTO sms_otps (phone, code, expires_at)
    VALUES (${phone}, ${code}, ${expiresAt}::timestamptz)
    ON CONFLICT (phone) DO UPDATE SET
      code       = ${code},
      expires_at = ${expiresAt}::timestamptz,
      created_at = now()
  `);

  // Store intended districts in a temporary column-less way: encode in OTP table
  // Districts are validated and re-sent in /verify. No extra column needed.
  // (districts list passed back by the client in the /verify call)

  try {
    await sendOtpSms(phone, code);
  } catch (err) {
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
    // In dev (no Twilio), surface the code directly so the form can be tested
    ...(process.env.NODE_ENV === 'development' && { devCode: code }),
  });
}
