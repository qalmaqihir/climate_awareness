import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

function parseAdminEmails(raw: string): string[] {
  const s = raw.trim();
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s) as unknown;
      if (Array.isArray(a))
        return (a as unknown[])
          .map(String)
          .map((e) => e.trim())
          .filter(Boolean);
    } catch {
      // fall through to comma-split
    }
  }
  return s
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}
const ADMIN_EMAILS = parseAdminEmails(process.env.ADMIN_EMAILS ?? '');

const postSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(128),
});

export const GET = withApiHandler(async () => {
  await requireAdmin();

  const contributors = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.role, 'contributor'))
    .orderBy(users.email);

  return NextResponse.json({ contributors });
});

export const POST = withApiHandler(async (req: Request) => {
  await requireAdmin();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, 'Invalid JSON');
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, password } = parsed.data;

  // Prevent granting contributor role to admin-designated addresses
  if (ADMIN_EMAILS.includes(email)) {
    throw new AppError(422, 'That email is already designated as an admin');
  }

  // Reject if a user record already exists for this email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) throw new AppError(409, 'A user with that email already exists');

  const passwordHash = await hash(password, 12);

  const [created] = await db
    .insert(users)
    .values({
      email,
      name: name ?? null,
      passwordHash,
      isAdmin: false,
      role: 'contributor',
    })
    .returning({ id: users.id, email: users.email, name: users.name });

  return NextResponse.json({ contributor: created }, { status: 201 });
});
