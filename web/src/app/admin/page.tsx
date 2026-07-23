import Link from 'next/link';
import { format } from 'date-fns';
import { getEventStats, getActiveAlerts, getEvents } from '@/lib/queries';
import { EVENT_TYPE_COLORS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  let stats = { total: 0, verified: 0, last30: 0 };
  let recentEvents: Awaited<ReturnType<typeof getEvents>> = [];
  let activeAlerts: Awaited<ReturnType<typeof getActiveAlerts>> = [];

  try {
    [stats, recentEvents, activeAlerts] = await Promise.all([
      getEventStats(),
      getEvents({ status: undefined }),
      getActiveAlerts(5),
    ]);
    recentEvents = recentEvents.slice(0, 8);
  } catch {
    // DB not yet available — show empty state
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <Link
          href="/admin/events/new"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + Add event
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: 'Total events', value: stats.total },
          { label: 'Verified', value: stats.verified },
          { label: 'Last 30 days', value: stats.last30 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent events */}
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-700">Recent events</h2>
            <Link href="/admin/events" className="text-xs text-teal-700 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentEvents.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                No events yet.{' '}
                <Link href="/admin/events/new" className="text-teal-700 hover:underline">
                  Add the first one
                </Link>
              </p>
            ) : (
              recentEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: EVENT_TYPE_COLORS[e.eventType] ?? '#6b7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{e.title}</p>
                    <p className="text-xs text-slate-400">
                      {e.district ?? 'GB'} · {format(e.reportedAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      e.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-700'
                        : e.status === 'archived'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-amber-100 text-amber-700',
                    ].join(' ')}
                  >
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active alerts */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-700">Active alerts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {activeAlerts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No active alerts.</p>
            ) : (
              activeAlerts.map((a) => (
                <div key={a.id} className="px-5 py-3">
                  <p className="text-xs font-semibold text-slate-700">{a.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {a.level} · {a.district ?? 'GB-wide'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
