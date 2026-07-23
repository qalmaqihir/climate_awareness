import Link from 'next/link';
import { format } from 'date-fns';
import { getEvents } from '@/lib/queries';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  let events: Awaited<ReturnType<typeof getEvents>> = [];

  try {
    events = await getEvents(undefined, 500);
  } catch {
    // DB not yet available
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <Link
          href="/admin/events/new"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + Add event
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {events.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            No events yet.{' '}
            <Link href="/admin/events/new" className="text-teal-700 hover:underline">
              Add the first one →
            </Link>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">District</th>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-800">
                    {e.title}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[e.eventType] ?? '#6b7280' }}
                    >
                      {EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{e.severity}</td>
                  <td className="px-4 py-3 text-slate-600">{e.district ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {format(e.reportedAt, 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        e.state === 'active'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500',
                      ].join(' ')}
                    >
                      {e.state ?? 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        e.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-700'
                          : e.status === 'archived'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-700',
                      ].join(' ')}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/events/${e.id}`}
                        target="_blank"
                        className="text-xs text-slate-400 hover:text-teal-700"
                      >
                        View
                      </Link>
                      <AdminEventActions eventId={e.id} currentStatus={e.status} />
                    </div>
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

function AdminEventActions({ eventId, currentStatus }: { eventId: number; currentStatus: string }) {
  if (currentStatus === 'archived') {
    return <span className="text-xs text-slate-300">Archived</span>;
  }
  return (
    <Link
      href={`/admin/events/${eventId}/edit`}
      className="text-xs text-slate-400 hover:text-teal-700"
    >
      Edit
    </Link>
  );
}
