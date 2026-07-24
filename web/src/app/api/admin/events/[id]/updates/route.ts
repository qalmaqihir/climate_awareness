import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, incidentUpdates } from '@/lib/schema';
import { getEventUpdates } from '@/lib/queries';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

const postSchema = z.object({
  updateText: z.string().min(5).max(2000),
  updateType: z.enum(['status', 'correction', 'resolution', 'severity_change']).default('status'),
});

type Props = { params: Promise<{ id: string }> };

export const GET = withApiHandler(async (_req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) throw new AppError(400, 'Invalid id');

  const updates = await getEventUpdates(eventId);
  return NextResponse.json({ updates });
});

export const POST = withApiHandler(async (req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) throw new AppError(400, 'Invalid id');

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) throw new AppError(404, 'Event not found');

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [created] = await db
    .insert(incidentUpdates)
    .values({
      eventId,
      updateText: parsed.data.updateText,
      updateType: parsed.data.updateType,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});
