import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import { db } from '@/lib/db';
import { leads, reviewDecisions } from '@/lib/schema';
import type { LeadState, ReviewDecisionAction } from '@/lib/schema';
import { getLeadById, getReviewerByEmail } from '@/lib/leads-queries';
import { isValidLeadTransition } from '@/lib/leads-state';
import { withApiHandler, AppError } from '@/lib/api-error';
import { requireAdmin } from '@/lib/auth-guard';

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  state: z.enum(['under_review', 'rejected', 'needs_clarification', 'archived'] as const),
  rationale: z.string().max(2000).optional(),
});

export const GET = withApiHandler(async (_req: Request, { params }: Props) => {
  await requireAdmin();
  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) throw new AppError(400, 'Invalid id');

  const lead = await getLeadById(leadId);
  if (!lead) throw new AppError(404, 'Not found');
  return NextResponse.json(lead);
});

export const PATCH = withApiHandler(async (req: Request, { params }: Props) => {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const toState = parsed.data.state as LeadState;
  const email = session.user.email ?? '';

  // Resolve reviewer before transaction — fail-closed if session email has no DB record
  const reviewer = email ? await getReviewerByEmail(email) : null;
  if (!reviewer) throw new AppError(500, 'Could not resolve reviewer account');

  await db.transaction(async (tx) => {
    // SELECT FOR UPDATE prevents two concurrent moderators from transitioning the same lead
    const [current] = await tx
      .select({ state: leads.state })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1)
      .for('update');

    if (!current) throw new AppError(404, 'Not found');

    if (!isValidLeadTransition(current.state as LeadState, toState)) {
      throw new AppError(422, `Cannot transition from '${current.state}' to '${toState}'`);
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

  return NextResponse.json({ id: leadId, state: toState });
});
