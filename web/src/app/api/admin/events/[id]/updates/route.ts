import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, incidentUpdates } from '@/lib/schema';
import { getEventUpdates } from '@/lib/queries';

const postSchema = z.object({
  updateText: z.string().min(5).max(2000),
  updateType: z.enum(['status', 'correction', 'resolution', 'severity_change']).default('status'),
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

  const updates = await getEventUpdates(eventId);
  return NextResponse.json({ updates });
}

export async function POST(req: Request, { params }: Props) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [created] = await db
    .insert(incidentUpdates)
    .values({
      eventId,
      updateText: parsed.data.updateText,
      updateType: parsed.data.updateType,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
