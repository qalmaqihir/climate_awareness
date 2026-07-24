import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, leads, reviewDecisions } from '@/lib/schema';
import { COVERAGE_ENVELOPE } from '@/lib/constants';
import { getReviewerByEmail } from '@/lib/leads-queries';

type Props = { params: Promise<{ id: string }> };

const publishSchema = z
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
    eventSubtype: z.enum(['flash_flood']).optional(),
    severity: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
    district: z.string().max(100).optional(),
    locationName: z.string().max(300).optional(),
    locationPrecision: z.enum(['exact', 'approximate', 'district', 'pending']).default('pending'),
    locationRationale: z.string().max(1000).optional(),
    latitude: z.number().min(COVERAGE_ENVELOPE.minLat).max(COVERAGE_ENVELOPE.maxLat).optional(),
    longitude: z.number().min(COVERAGE_ENVELOPE.minLng).max(COVERAGE_ENVELOPE.maxLng).optional(),
    reportedAt: z.string().datetime(),
    rationale: z.string().min(1).max(2000),
  })
  .refine((d) => (d.latitude == null) === (d.longitude == null), {
    message: 'Provide both latitude and longitude, or neither',
  })
  .refine((d) => d.eventSubtype == null || d.eventType === 'flood', {
    message: 'eventSubtype only valid when eventType is flood',
  })
  .refine((d) => d.locationPrecision !== 'exact' || (d.latitude != null && d.longitude != null), {
    message: 'exact precision requires coordinates',
  });

export async function POST(req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify lead exists and is in a publishable state
  const [current] = await db
    .select({ state: leads.state })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!current) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (current.state !== 'under_review') {
    return NextResponse.json(
      { error: `Lead must be 'under_review' to publish (current: '${current.state}')` },
      { status: 422 },
    );
  }

  const email = session.user.email ?? '';
  const reviewer = email ? await getReviewerByEmail(email) : null;

  const d = parsed.data;
  const locationWkt =
    d.latitude != null && d.longitude != null ? `POINT(${d.longitude} ${d.latitude})` : undefined;

  let createdEventId: number;
  await db.transaction(async (tx) => {
    // 1. Create the event (status='unverified' — moderator verifies separately in event admin)
    const [created] = await tx
      .insert(events)
      .values({
        title: d.title,
        description: d.description,
        eventType: d.eventType,
        eventSubtype: d.eventSubtype,
        severity: d.severity,
        status: 'unverified',
        state: 'active',
        district: d.district,
        locationName: d.locationName,
        locationPrecision: d.locationPrecision,
        locationRationale: d.locationRationale ?? `Published from lead #${leadId}`,
        location: locationWkt as unknown as string,
        reportedAt: new Date(d.reportedAt),
      })
      .returning({ id: events.id });

    createdEventId = created.id;

    // 2. Mark lead as published and link to the new event
    await tx
      .update(leads)
      .set({ state: 'published', publishedEventId: created.id, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    // 3. Record the review decision (immutable audit)
    if (reviewer) {
      await tx.insert(reviewDecisions).values({
        reviewerId: reviewer.id,
        reviewerEmail: reviewer.email ?? email,
        targetType: 'lead',
        targetId: leadId,
        action: 'publish',
        rationale: d.rationale,
        beforeState: { state: 'under_review' },
        afterState: { state: 'published', publishedEventId: created.id },
      });
    }
  });

  return NextResponse.json({ eventId: createdEventId!, leadId }, { status: 201 });
}
