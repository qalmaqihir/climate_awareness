import type { LeadState } from './schema';

// Valid state transitions. 'published' is reached only via the /publish API
// (which atomically creates an event + records a review_decision).
export const LEAD_TRANSITIONS: Record<LeadState, readonly LeadState[]> = {
  submitted: ['under_review', 'rejected'],
  needs_clarification: ['under_review'],
  under_review: ['rejected', 'needs_clarification'],
  // Terminal states — no further PATCH transitions allowed
  published: [],
  rejected: [],
  archived: [],
} as const;

export function isValidLeadTransition(from: LeadState, to: LeadState): boolean {
  return (LEAD_TRANSITIONS[from] ?? []).includes(to);
}

export const LEAD_STATE_LABELS: Record<LeadState, string> = {
  submitted: 'Submitted',
  needs_clarification: 'Needs info',
  under_review: 'In review',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const LEAD_STATE_COLORS: Record<LeadState, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  needs_clarification: 'bg-amber-100 text-amber-700',
  under_review: 'bg-purple-100 text-purple-700',
  published: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-500',
  archived: 'bg-slate-100 text-slate-400',
};

// States shown in the queue tab bar (ordered for moderator workflow)
export const LEAD_QUEUE_TABS: { state: LeadState | 'all'; label: string }[] = [
  { state: 'all', label: 'All' },
  { state: 'submitted', label: 'Submitted' },
  { state: 'under_review', label: 'In review' },
  { state: 'needs_clarification', label: 'Needs info' },
  { state: 'published', label: 'Published' },
  { state: 'rejected', label: 'Rejected' },
];
