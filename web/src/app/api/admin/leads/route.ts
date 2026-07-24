import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { getLeads, LEADS_PER_PAGE } from '@/lib/leads-queries';
import type { LeadState } from '@/lib/schema';

const VALID_STATES: LeadState[] = [
  'submitted',
  'needs_clarification',
  'under_review',
  'published',
  'rejected',
  'archived',
];

const querySchema = z.object({
  state: z.enum(VALID_STATES as [LeadState, ...LeadState[]]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { state, page } = parsed.data;
  const offset = (page - 1) * LEADS_PER_PAGE;
  const rows = await getLeads({ state }, LEADS_PER_PAGE, offset);
  return NextResponse.json({
    leads: rows,
    page,
    perPage: LEADS_PER_PAGE,
    hasMore: rows.length === LEADS_PER_PAGE,
  });
}
