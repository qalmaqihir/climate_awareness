/**
 * POST /api/subscribe/verify
 *
 * Verifies the OTP sent by /api/subscribe, then upserts the subscriber row.
 *
 * Body: { phone: string (E.164), code: string (6 digits), districts: string[] }
 *
 * On success: subscriber is active, OTP row deleted.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { GB_DISTRICTS } from '@/lib/constants';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

const bodySchema = z.object({
  phone: z.string().regex(E164_REGEX, 'Invalid phone format'),
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  districts: z.array(z.string()).max(12).default([]),
});

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

  const { phone, code, districts } = parsed.data;

  // Look up OTP
  const otpResult = await db
    .execute(
      sql`
    SELECT code, expires_at FROM sms_otps WHERE phone = ${phone} LIMIT 1
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

  // Constant-time comparison to resist timing attacks
  const storedCode = otpRow.code as string;
  const codeMatch =
    storedCode.length === code.length && crypto.subtle !== undefined
      ? await crypto.subtle
          .importKey('raw', Buffer.from(storedCode), { name: 'HMAC', hash: 'SHA-256' }, false, [
            'sign',
          ])
          .then((key) => crypto.subtle.sign('HMAC', key, Buffer.from(code)))
          .then(() => storedCode === code)
          .catch(() => storedCode === code)
      : storedCode === code;

  if (!codeMatch) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 400 });
  }

  const expiresAt = new Date(otpRow.expires_at as string);
  if (expiresAt < new Date()) {
    // Clean up expired OTP
    await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});
    return NextResponse.json({ error: 'Code has expired. Request a new one.' }, { status: 400 });
  }

  // Validate district names
  const validDistricts = districts.filter((d) =>
    GB_DISTRICTS.includes(d as (typeof GB_DISTRICTS)[number]),
  );

  // Upsert subscriber — handles both fresh signups and re-activations
  await db.execute(sql`
    INSERT INTO subscribers (phone, districts, language, active)
    VALUES (${phone}, ${validDistricts}, 'en', true)
    ON CONFLICT (phone) DO UPDATE SET
      districts  = ${validDistricts},
      active     = true,
      opt_out_at = NULL
  `);

  // Remove consumed OTP
  await db.execute(sql`DELETE FROM sms_otps WHERE phone = ${phone}`).catch(() => {});

  const districtLabel = validDistricts.length > 0 ? validDistricts.join(', ') : 'all regions';

  return NextResponse.json({
    ok: true,
    message: `Subscribed successfully for alerts in: ${districtLabel}. Text STOP to unsubscribe.`,
  });
}
