import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { and, eq, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, incidentRelations } from '@/lib/schema';
import { getEventRelations } from '@/lib/queries';

const postSchema = z.object({
  targetEventId: z.number().int(),
  relationType: z.enum(['duplicate', 'related', 'supersedes']),
  note: z.string().max(500).optional(),
});

const deleteSchema = z.object({
  relationId: z.number().int(),
});

type Props = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await auth();
  return session?.user?.isAdmin ? session : null;
}

export async function GET(_req: Request, { params }: Props) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const relations = await getEventRelations(eventId);
  return NextResponse.json({ relations });
}

export async function POST(req: Request, { params }: Props) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { targetEventId, relationType, note } = parsed.data;

  if (targetEventId === eventId) {
    return NextResponse.json({ error: 'Cannot relate an event to itself' }, { status: 422 });
  }

  // Verify both events exist
  const [target] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, targetEventId))
    .limit(1);
  if (!target) return NextResponse.json({ error: 'Target event not found' }, { status: 404 });

  // Enforce canonical ordering (CHECK constraint requires source < target)
  const sourceId = Math.min(eventId, targetEventId);
  const targetId = Math.max(eventId, targetEventId);

  const [created] = await db
    .insert(incidentRelations)
    .values({ sourceEventId: sourceId, targetEventId: targetId, relationType, note: note ?? null })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    return NextResponse.json({ error: 'Relation already exists' }, { status: 409 });
  }

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request, { params }: Props) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  // Only delete if the relation actually involves this event (prevents cross-event deletes)
  const deleted = await db
    .delete(incidentRelations)
    .where(
      and(
        eq(incidentRelations.id, parsed.data.relationId),
        or(
          eq(incidentRelations.sourceEventId, eventId),
          eq(incidentRelations.targetEventId, eventId),
        ),
      ),
    )
    .returning({ id: incidentRelations.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Relation not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: deleted[0].id });
}
