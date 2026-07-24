import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { getLeads } from '@/lib/leads-queries';
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
  limit: z.coerce.number().int().min(1).max(500).default(200),
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

  const rows = await getLeads({ state: parsed.data.state }, parsed.data.limit);
  return NextResponse.json({ leads: rows, total: rows.length });
}
