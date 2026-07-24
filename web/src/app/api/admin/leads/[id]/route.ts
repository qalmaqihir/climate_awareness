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
  state: z.enum(['under_review', 'rejected', 'needs_clarification', 'archived'] as const),
  rationale: z.string().max(2000).optional(),
});

class RouteError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

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
  const email = session.user.email ?? '';

  // Resolve reviewer before transaction — fail-closed if session email has no DB record
  const reviewer = email ? await getReviewerByEmail(email) : null;
  if (!reviewer) {
    return NextResponse.json({ error: 'Could not resolve reviewer account' }, { status: 500 });
  }

  try {
    await db.transaction(async (tx) => {
      // SELECT FOR UPDATE prevents two concurrent moderators from transitioning the same lead
      const [current] = await tx
        .select({ state: leads.state })
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1)
        .for('update');

      if (!current) throw new RouteError(404, 'Not found');

      if (!isValidLeadTransition(current.state as LeadState, toState)) {
        throw new RouteError(422, `Cannot transition from '${current.state}' to '${toState}'`);
      }

      await tx
        .update(leads)
        .set({ state: toState, updatedAt: new Date() })
        .where(eq(leads.id, leadId));

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
    });
  } catch (e) {
    if (e instanceof RouteError) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    throw e;
  }

  return NextResponse.json({ id: leadId, state: toState });
}
