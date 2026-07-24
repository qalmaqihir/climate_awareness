/**
 * POST /api/subscribe/verify
 *
 * Verifies the OTP sent by /api/subscribe, then upserts the subscriber row.
 * Uses stored hash (SHA-256) comparison with timingSafeEqual.
 * Invalidates OTP after 5 failed attempts to prevent brute force.
 * Uses districts stored at subscribe time — ignores client-supplied list.
 *
 * Body: { phone: string (E.164), code: string (6 digits) }
 *
 * On success: subscriber is active, OTP row deleted.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

const MAX_OTP_ATTEMPTS = 5;
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const bodySchema = z.object({
  phone: z.string().regex(E164_REGEX, 'Invalid phone format'),
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

interface RateBucket {
  count: number;
  resetAt: number;
}
const ipBuckets = new Map<string, RateBucket>();
const VERIFY_IP_LIMIT = 20;
const VERIFY_WINDOW_MS = 60 * 60 * 1_000;

function checkVerifyRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return true;
  }
  if (bucket.count >= VERIFY_IP_LIMIT) return false;
  bucket.count += 1;
  return true;
}

setInterval(
  () => {
    const now = Date.now();
    for (const [k, b] of ipBuckets) if (now > b.resetAt) ipBuckets.delete(k);
  },
  2 * 60 * 60 * 1_000,
);

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  if (!checkVerifyRateLimit(ip)) {
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

  const { phone, code } = parsed.data;

  // Look up OTP
  const otpResult = await db
    .execute(
      sql`
    SELECT code, districts, attempt_count, expires_at
    FROM sms_otps WHERE phone = ${phone} LIMIT 1
  `,
    )
    .catch(() => null);

  const otpRow = otpResult?.rows[0];

  if (!otpRow) {
    return NextResponse.json(
      { error: 'No pending verification found. Request a new code.' },
      { status: 404 },
    );
  }

  // Brute-force protection: invalidate after too many failed attempts
  if ((otpRow.attempt_count as number) >= MAX_OTP_ATTEMPTS) {
    await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});
    return NextResponse.json(
      { error: 'Too many failed attempts. Request a new code.' },
      { status: 400 },
    );
  }

  // Expiry check before comparing (avoids incrementing attempt_count on expired OTPs)
  const expiresAt = new Date(otpRow.expires_at as string);
  if (expiresAt < new Date()) {
    await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});
    return NextResponse.json({ error: 'Code has expired. Request a new one.' }, { status: 400 });
  }

  // Constant-time hash comparison — compares SHA-256(user_input) vs stored hash
  const storedHash = Buffer.from(otpRow.code as string, 'hex');
  const inputHash = Buffer.from(createHash('sha256').update(code).digest('hex'), 'hex');

  const codeMatch =
    storedHash.length === inputHash.length && timingSafeEqual(storedHash, inputHash);

  if (!codeMatch) {
    // Increment attempt counter; delete row when limit is hit
    const newCount = (otpRow.attempt_count as number) + 1;
    if (newCount >= MAX_OTP_ATTEMPTS) {
      await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});
    } else {
      await db
        .execute(sql`UPDATE sms_otps SET attempt_count = ${newCount} WHERE phone = ${phone}`)
        .catch(() => {});
    }
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - newCount);
    return NextResponse.json(
      {
        error: `Invalid code.${remaining > 0 ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` : ' Code invalidated.'}`,
      },
      { status: 400 },
    );
  }

  // Use districts stored at subscribe time — never trust client-resupplied list
  const validDistricts = (otpRow.districts as string[]) ?? [];

  // Upsert subscriber — handles both fresh signups and re-activations
  const upsertResult = await db
    .execute(
      sql`
      INSERT INTO subscribers (phone, districts, language, active)
      VALUES (${phone}, ${validDistricts}, 'en', true)
      ON CONFLICT (phone) DO UPDATE SET
        districts  = ${validDistricts},
        active     = true,
        opt_out_at = NULL
    `,
    )
    .catch(() => null);

  if (!upsertResult) {
    return NextResponse.json(
      { error: 'Subscription could not be saved. Please try again.' },
      { status: 500 },
    );
  }

  // Remove consumed OTP
  await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});

  const districtLabel = validDistricts.length > 0 ? validDistricts.join(', ') : 'all regions';

  return NextResponse.json({
    ok: true,
    message: `Subscribed successfully for alerts in: ${districtLabel}. Text STOP to unsubscribe.`,
  });
}
