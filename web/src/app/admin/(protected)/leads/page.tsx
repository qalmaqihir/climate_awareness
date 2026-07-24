import Link from 'next/link';
import { format } from 'date-fns';
import type { LeadState } from '@/lib/schema';
import { getLeads, LEADS_PER_PAGE } from '@/lib/leads-queries';
import { LEAD_STATE_LABELS, LEAD_STATE_COLORS, LEAD_QUEUE_TABS } from '@/lib/leads-state';
import { EVENT_TYPE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const VALID_LEAD_STATES: LeadState[] = [
  'submitted',
  'needs_clarification',
  'under_review',
  'published',
  'rejected',
  'archived',
];

type Props = { searchParams: Promise<{ state?: string; page?: string }> };

export default async function LeadsQueuePage({ searchParams }: Props) {
  const { state: rawState, page: rawPage } = await searchParams;
  // Validate rawState against known states to prevent unchecked values reaching getLeads
  const isValidState = rawState !== undefined && VALID_LEAD_STATES.includes(rawState as LeadState);
  const activeTab: LeadState | 'all' = isValidState ? (rawState as LeadState) : 'all';
  const filterState = activeTab === 'all' ? undefined : activeTab;

  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1);
  const offset = (page - 1) * LEADS_PER_PAGE;
  const rows = await getLeads({ state: filterState }, LEADS_PER_PAGE, offset);
  const hasMore = rows.length === LEADS_PER_PAGE;

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (activeTab !== 'all') params.set('state', activeTab);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/admin/leads${qs ? `?${qs}` : ''}`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Private reports from trusted contributors awaiting moderator review.
          </p>
        </div>
      </div>

      {/* State tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {LEAD_QUEUE_TABS.map((tab) => {
          const isActive = tab.state === activeTab;
          return (
            <Link
              key={tab.state}
              href={tab.state === 'all' ? '/admin/leads' : `/admin/leads?state=${tab.state}`}
              className={[
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Queue table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">No leads in this state.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Submitted by</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-800">
                    {lead.title}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lead.eventType ? (EVENT_TYPE_LABELS[lead.eventType] ?? lead.eventType) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{lead.district ?? '—'}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-500">
                    {lead.submitterEmail}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {format(lead.createdAt, 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${LEAD_STATE_COLORS[lead.state as LeadState] ?? ''}`}
                    >
                      {LEAD_STATE_LABELS[lead.state as LeadState] ?? lead.state}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-xs text-teal-700 hover:underline"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                ← Previous
              </Link>
            )}
            {hasMore && (
              <Link
                href={pageUrl(page + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
