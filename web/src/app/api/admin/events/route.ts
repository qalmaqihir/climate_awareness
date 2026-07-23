import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { events } from '@/lib/schema';
import { desc } from 'drizzle-orm';
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
    severity: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
    status: z.enum(['verified', 'unverified', 'disputed', 'archived']).default('unverified'),
    district: z.string().optional(),
    locationName: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
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
  });

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
      severity: events.severity,
      status: events.status,
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
  const locationWkt =
    d.latitude != null && d.longitude != null ? `POINT(${d.longitude} ${d.latitude})` : undefined;

  const [created] = await db
    .insert(events)
    .values({
      title: d.title,
      description: d.description,
      eventType: d.eventType,
      severity: d.severity,
      status: d.status,
      district: d.district,
      locationName: d.locationName,
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
