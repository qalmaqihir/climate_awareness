import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, incidentRelations } from '@/lib/schema';
import { getEventRelations } from '@/lib/queries';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

const postSchema = z.object({
  targetEventId: z.number().int(),
  relationType: z.enum(['duplicate', 'related', 'supersedes']),
  note: z.string().max(500).optional(),
});

const deleteSchema = z.object({
  relationId: z.number().int(),
});

type Props = { params: Promise<{ id: string }> };

export const GET = withApiHandler(async (_req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) throw new AppError(400, 'Invalid id');

  const relations = await getEventRelations(eventId);
  return NextResponse.json({ relations });
});

export const POST = withApiHandler(async (req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) throw new AppError(400, 'Invalid id');

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { targetEventId, relationType, note } = parsed.data;

  if (targetEventId === eventId) throw new AppError(422, 'Cannot relate an event to itself');

  // Verify both events exist
  const [target] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, targetEventId))
    .limit(1);
  if (!target) throw new AppError(404, 'Target event not found');

  // Enforce canonical ordering (CHECK constraint requires source < target)
  const sourceId = Math.min(eventId, targetEventId);
  const targetId = Math.max(eventId, targetEventId);

  const [created] = await db
    .insert(incidentRelations)
    .values({ sourceEventId: sourceId, targetEventId: targetId, relationType, note: note ?? null })
    .onConflictDoNothing()
    .returning();

  if (!created) throw new AppError(409, 'Relation already exists');
  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) throw new AppError(400, 'Invalid id');

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, 'Invalid body');

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

  if (deleted.length === 0) throw new AppError(404, 'Relation not found');
  return NextResponse.json({ deleted: deleted[0].id });
});
