import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { COVERAGE_ENVELOPE } from '@/lib/constants';
import { sanitizeEmbed } from '@/lib/sanitize';
import { getEventById } from '@/lib/queries';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

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
    eventSubtype: z.enum(['flash_flood']).nullable().optional(),
    severity: z.enum(['low', 'moderate', 'high', 'critical']).optional(),
    status: z.enum(['verified', 'unverified', 'disputed', 'archived']).optional(),
    state: z.enum(['active', 'resolved']).optional(),
    district: z.string().max(100).optional(),
    locationName: z.string().max(300).optional(),
    locationPrecision: z.enum(['exact', 'approximate', 'district', 'pending']).optional(),
    locationRationale: z.string().max(1000).nullable().optional(),
    latitude: z.number().min(COVERAGE_ENVELOPE.minLat).max(COVERAGE_ENVELOPE.maxLat).optional(),
    longitude: z.number().min(COVERAGE_ENVELOPE.minLng).max(COVERAGE_ENVELOPE.maxLng).optional(),
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
  })
  .refine((d) => d.eventSubtype == null || d.eventType == null || d.eventType === 'flood', {
    message: 'eventSubtype is only valid when eventType is flood',
  })
  .refine(
    (d) => {
      // Only enforce when new coordinates are being explicitly sent (not a precision-only update).
      // undefined means "leave existing DB value" — the event may already have valid coordinates.
      if (d.locationPrecision === 'exact' && d.latitude !== undefined) {
        return d.latitude != null && d.longitude != null;
      }
      return true;
    },
    { message: 'exact precision requires latitude and longitude' },
  );

function parseEventId(id: string): number {
  const n = parseInt(id);
  if (isNaN(n)) throw new AppError(400, 'Invalid id');
  return n;
}

export const GET = withApiHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const eventId = parseEventId(id);
    const event = await getEventById(eventId);
    if (!event) throw new AppError(404, 'Not found');
    return NextResponse.json(event);
  },
);

export const PATCH = withApiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const eventId = parseEventId(id);

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
        ...(d.eventSubtype !== undefined && { eventSubtype: d.eventSubtype }),
        ...(d.severity !== undefined && { severity: d.severity }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.state !== undefined && { state: d.state }),
        ...(d.district !== undefined && { district: d.district }),
        ...(d.locationName !== undefined && { locationName: d.locationName }),
        ...(d.locationPrecision !== undefined && { locationPrecision: d.locationPrecision }),
        ...(d.locationRationale !== undefined && { locationRationale: d.locationRationale }),
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

    if (updated.length === 0) throw new AppError(404, 'Event not found');
    return NextResponse.json({ ok: true });
  },
);

// Soft-delete: set status to archived (archived ≠ resolved; this is editorial removal)
export const DELETE = withApiHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const eventId = parseEventId(id);

    const deleted = await db
      .update(events)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning({ id: events.id });

    if (deleted.length === 0) throw new AppError(404, 'Event not found');
    return NextResponse.json({ ok: true });
  },
);
