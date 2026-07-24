import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { events, leads, reviewDecisions } from '@/lib/schema';
import { COVERAGE_ENVELOPE } from '@/lib/constants';
import { getReviewerByEmail } from '@/lib/leads-queries';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

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

export const POST = withApiHandler(async (req: Request, { params }: Props) => {
  const session = await requireAdmin();
  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) throw new AppError(400, 'Invalid id');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, 'Invalid JSON');
  }

  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = session.user.email ?? '';

  // Resolve reviewer before transaction — review_decisions.reviewer_id is NOT NULL
  const reviewer = email ? await getReviewerByEmail(email) : null;
  if (!reviewer) throw new AppError(500, 'Could not resolve reviewer account');

  const d = parsed.data;
  const locationWkt =
    d.latitude != null && d.longitude != null ? `POINT(${d.longitude} ${d.latitude})` : undefined;

  let createdEventId: number | null = null;

  await db.transaction(async (tx) => {
    // SELECT FOR UPDATE prevents two concurrent publish attempts on the same lead
    const [current] = await tx
      .select({ state: leads.state })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1)
      .for('update');

    if (!current) throw new AppError(404, 'Lead not found');
    if (current.state !== 'under_review') {
      throw new AppError(
        422,
        `Lead must be 'under_review' to publish (current: '${current.state}')`,
      );
    }

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
  });

  if (createdEventId === null) throw new AppError(500, 'Publish failed unexpectedly');
  return NextResponse.json({ eventId: createdEventId, leadId }, { status: 201 });
});
