import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';

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

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, password } = parsed.data;

  // Prevent granting contributor role to admin-designated addresses
  if (ADMIN_EMAILS.includes(email)) {
    return NextResponse.json(
      { error: 'That email is already designated as an admin' },
      { status: 422 },
    );
  }

  // Reject if a user record already exists for this email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 });
  }

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
}
