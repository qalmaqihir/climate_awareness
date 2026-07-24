import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, reviewDecisions } from '@/lib/schema';
import type { LeadState, ReviewDecisionAction } from '@/lib/schema';
import { getLeadById, getReviewerByEmail } from '@/lib/leads-queries';
import { isValidLeadTransition } from '@/lib/leads-state';

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  state: z.enum(['under_review', 'rejected', 'needs_clarification'] as const),
  rationale: z.string().max(2000).optional(),
});

export async function GET(_req: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const lead = await getLeadById(leadId);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: Props) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const toState = parsed.data.state as LeadState;

  // Load current state
  const [current] = await db
    .select({ state: leads.state })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!isValidLeadTransition(current.state as LeadState, toState)) {
    return NextResponse.json(
      { error: `Cannot transition from '${current.state}' to '${toState}'` },
      { status: 422 },
    );
  }

  const email = session.user.email ?? '';
  const reviewer = email ? await getReviewerByEmail(email) : null;

  await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({ state: toState, updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    if (reviewer) {
      await tx.insert(reviewDecisions).values({
        reviewerId: reviewer.id,
        reviewerEmail: reviewer.email ?? email,
        targetType: 'lead',
        targetId: leadId,
        action: (toState === 'under_review' ? 'claim' : toState) as ReviewDecisionAction,
        rationale: parsed.data.rationale ?? null,
        beforeState: { state: current.state },
        afterState: { state: toState },
      });
    }
  });

  return NextResponse.json({ id: leadId, state: toState });
}
