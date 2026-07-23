import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { sanitizeEmbed } from '@/lib/sanitize';

const patchSchema = z
  .object({
    title: z.string().min(3).max(300).optional(),
    description: z.string().max(10_000).optional(),
    eventType: z
      .enum([
        'glof',
        'flood',
        'landslide',
        'infrastructure_damage',
        'casualty',
        'displacement',
        'other',
      ])
      .optional(),
    severity: z.enum(['low', 'moderate', 'high', 'critical']).optional(),
    status: z.enum(['verified', 'unverified', 'disputed', 'archived']).optional(),
    district: z.string().optional(),
    locationName: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    sourceUrl: z
      .string()
      .url()
      .refine((url) => /^https?:\/\//i.test(url), 'Only http/https URLs allowed')
      .optional(),
    embedHtml: z.string().max(50_000).optional(),
    affectedCount: z.number().int().min(0).optional(),
    reportedAt: z.string().datetime().optional(),
  })
  .refine((d) => (d.latitude !== undefined) === (d.longitude !== undefined), {
    message: 'Provide both latitude and longitude, or neither',
  });

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const locationWkt =
    d.latitude != null && d.longitude != null ? `POINT(${d.longitude} ${d.latitude})` : undefined;

  const updated = await db
    .update(events)
    .set({
      ...(d.title !== undefined && { title: d.title }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.eventType !== undefined && { eventType: d.eventType }),
      ...(d.severity !== undefined && { severity: d.severity }),
      ...(d.status !== undefined && { status: d.status }),
      ...(d.district !== undefined && { district: d.district }),
      ...(d.locationName !== undefined && { locationName: d.locationName }),
      ...(locationWkt !== undefined && { location: locationWkt as unknown as string }),
      ...(d.sourceUrl !== undefined && { sourceUrl: d.sourceUrl }),
      ...(d.embedHtml !== undefined && {
        embedHtml: d.embedHtml != null ? sanitizeEmbed(d.embedHtml) : null,
      }),
      ...(d.affectedCount !== undefined && { affectedCount: d.affectedCount }),
      ...(d.reportedAt !== undefined && { reportedAt: new Date(d.reportedAt) }),
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .returning({ id: events.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// Soft-delete: set status to archived
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const deleted = await db
    .update(events)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(events.id, eventId))
    .returning({ id: events.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
