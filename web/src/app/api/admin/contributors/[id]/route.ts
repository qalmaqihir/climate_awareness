import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  password: z.string().min(8).max(128),
});

export async function PATCH(req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.password, 12);

  const result = await db
    .update(users)
    .set({ passwordHash })
    .where(and(eq(users.id, id), eq(users.role, 'contributor')))
    .returning({ id: users.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
  }

  return NextResponse.json({ updated: result[0].id });
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Restrict delete to contributor-role records only — cannot delete admins via this route
  const result = await db
    .delete(users)
    .where(and(eq(users.id, id), eq(users.role, 'contributor')))
    .returning({ id: users.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: result[0].id });
}
