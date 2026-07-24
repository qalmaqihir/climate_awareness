import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';

type Props = { params: Promise<{ id: string }> };

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
