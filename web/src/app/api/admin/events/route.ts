import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, sources } from '@/lib/schema';
import { COVERAGE_ENVELOPE } from '@/lib/constants';
import { desc, eq } from 'drizzle-orm';
import { sanitizeEmbed } from '@/lib/sanitize';

const createSchema = z
  .object({
    title: z.string().min(3).max(300),
    description: z.string().max(10_000).optional(),
    eventType: z.enum([
      'glof',
      'flood',
      'landslide',
      'infrastructure_damage',
      'casualty',
      'displacement',
      'other',
    ]),
    // eventSubtype is valid only when eventType == 'flood'
    eventSubtype: z.enum(['flash_flood']).optional(),
    severity: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
    status: z.enum(['verified', 'unverified', 'disputed', 'archived']).default('unverified'),
    // public lifecycle: separate from editorial status
    state: z.enum(['active', 'resolved']).default('active'),
    district: z.string().max(100).optional(),
    locationName: z.string().max(300).optional(),
    // honest location model: precision must always be set when coordinates are present
    locationPrecision: z.enum(['exact', 'approximate', 'district', 'pending']).default('pending'),
    locationRationale: z.string().max(1000).optional(),
    latitude: z.number().min(COVERAGE_ENVELOPE.minLat).max(COVERAGE_ENVELOPE.maxLat).optional(),
    longitude: z.number().min(COVERAGE_ENVELOPE.minLng).max(COVERAGE_ENVELOPE.maxLng).optional(),
    sourceId: z.number().int().optional(),
    sourceUrl: z
      .string()
      .url()
      .refine((url) => /^https?:\/\//i.test(url), 'Only http/https URLs allowed')
      .optional(),
    sourcePostId: z.string().optional(),
    embedHtml: z.string().max(50_000).optional(),
    affectedCount: z.number().int().min(0).optional(),
    reportedAt: z.string().datetime(),
  })
  .refine((d) => (d.latitude == null) === (d.longitude == null), {
    message: 'Provide both latitude and longitude, or neither',
  })
  .refine((d) => d.eventSubtype == null || d.eventType === 'flood', {
    message: 'eventSubtype is only valid when eventType is flood',
  })
  .refine(
    (d) => {
      // exact precision requires coordinates
      if (d.locationPrecision === 'exact') return d.latitude != null && d.longitude != null;
      return true;
    },
    { message: 'exact precision requires latitude and longitude' },
  );

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      eventType: events.eventType,
      eventSubtype: events.eventSubtype,
      severity: events.severity,
      status: events.status,
      state: events.state,
      locationPrecision: events.locationPrecision,
      district: events.district,
      locationName: events.locationName,
      sourceUrl: events.sourceUrl,
      affectedCount: events.affectedCount,
      reportedAt: events.reportedAt,
      createdAt: events.createdAt,
    })
    .from(events)
    .orderBy(desc(events.reportedAt))
    .limit(500);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  if (d.sourceId != null) {
    const [src] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.id, d.sourceId))
      .limit(1);
    if (!src) {
      return NextResponse.json({ error: 'sourceId not found' }, { status: 422 });
    }
  }

  const locationWkt =
    d.latitude != null && d.longitude != null ? `POINT(${d.longitude} ${d.latitude})` : undefined;

  const [created] = await db
    .insert(events)
    .values({
      title: d.title,
      description: d.description,
      eventType: d.eventType,
      eventSubtype: d.eventSubtype,
      severity: d.severity,
      status: d.status,
      state: d.state,
      district: d.district,
      locationName: d.locationName,
      locationPrecision: d.locationPrecision,
      locationRationale: d.locationRationale,
      location: locationWkt as unknown as string,
      sourceId: d.sourceId,
      sourceUrl: d.sourceUrl,
      sourcePostId: d.sourcePostId,
      embedHtml: d.embedHtml != null ? sanitizeEmbed(d.embedHtml) : undefined,
      affectedCount: d.affectedCount,
      reportedAt: new Date(d.reportedAt),
    })
    .returning({ id: events.id });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
