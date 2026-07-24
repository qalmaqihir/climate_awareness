import { NextResponse } from 'next/server';
import { gt, and, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, leadEvidence } from '@/lib/schema';
import { submitSchema } from '@/lib/leads-submission-schema';

export { submitSchema, EVENT_TYPES } from '@/lib/leads-submission-schema';

const RATE_LIMIT_PER_HOUR = 5;

// ─── POST /api/leads — authenticated contributor submission ───────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Only contributors may submit leads — admins have a separate event creation flow
  if (session.user.role !== 'contributor') {
    return NextResponse.json({ error: 'Only contributors can submit reports' }, { status: 403 });
  }

  const email = session.user.email;

  // DB-backed sliding-window rate limit — survives restarts, works on single VPS
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ recentCount }] = await db
    .select({ recentCount: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.submitterEmail, email), gt(leads.createdAt, oneHourAgo)));

  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: `Rate limit reached — max ${RATE_LIMIT_PER_HOUR} reports per hour` },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const d = parsed.data;

  // Wrap lead + optional evidence in one transaction so partial failure is impossible
  const newLead = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(leads)
      .values({
        submitterId: session.user.id ?? null,
        submitterEmail: email,
        intakeChannel: 'web',
        title: d.title,
        description: d.description,
        eventType: d.eventType ?? null,
        locationDescription: d.locationDescription ?? null,
        district: d.district ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        // Append T00:00:00Z so the date string is parsed as UTC midnight, not local time
        occurredAt: d.occurredAt ? new Date(d.occurredAt + 'T00:00:00Z') : null,
        contactPermission: d.contactPermission,
        contactInfo: d.contactPermission ? (d.contactInfo ?? null) : null,
        state: 'submitted',
      })
      .returning({ id: leads.id });

    if (d.sourceUrl) {
      await tx.insert(leadEvidence).values({
        leadId: inserted.id,
        evidenceType: 'url',
        sourceUrl: d.sourceUrl,
        description: d.sourceDescription ?? null,
        privacyState: 'moderator_only',
        reviewerVisibility: 'internal',
      });
    }

    return inserted;
  });

  return NextResponse.json(
    { id: newLead.id, message: 'Report received — a moderator will review it shortly.' },
    { status: 201 },
  );
}
