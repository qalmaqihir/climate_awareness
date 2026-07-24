import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  password: z.string().min(8).max(128),
});

export const PATCH = withApiHandler(async (req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, 'Invalid JSON');
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

  if (result.length === 0) throw new AppError(404, 'Contributor not found');
  return NextResponse.json({ updated: result[0].id });
});

export const DELETE = withApiHandler(async (_req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;

  // Restrict delete to contributor-role records only — cannot delete admins via this route
  const result = await db
    .delete(users)
    .where(and(eq(users.id, id), eq(users.role, 'contributor')))
    .returning({ id: users.id });

  if (result.length === 0) throw new AppError(404, 'Contributor not found');
  return NextResponse.json({ deleted: result[0].id });
});
