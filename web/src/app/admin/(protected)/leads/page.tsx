import Link from 'next/link';
import { format } from 'date-fns';
import type { LeadState } from '@/lib/schema';
import { getLeads } from '@/lib/leads-queries';
import { LEAD_STATE_LABELS, LEAD_STATE_COLORS, LEAD_QUEUE_TABS } from '@/lib/leads-state';
import { EVENT_TYPE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ state?: string }> };

export default async function LeadsQueuePage({ searchParams }: Props) {
  const { state: rawState } = await searchParams;
  const activeTab = (rawState as LeadState | 'all') ?? 'all';
  const filterState = activeTab === 'all' ? undefined : (activeTab as LeadState);

  const rows = await getLeads({ state: filterState }, 200);

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
    </div>
  );
}
