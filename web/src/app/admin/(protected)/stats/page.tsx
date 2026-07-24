import { getModeratorStats } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function StatsPage() {
  const stats = await getModeratorStats();
  const { leads: ls, events: es, avgReviewHours } = stats;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Moderation stats</h1>
        <p className="mt-1 text-sm text-slate-500">Live snapshot — refreshes on every page load.</p>
      </div>

      {/* Lead funnel */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Lead funnel
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={ls.total} />
          <StatCard label="Submitted" value={ls.submitted} sub="awaiting claim" />
          <StatCard label="Under review" value={ls.underReview} />
          <StatCard label="Published" value={ls.published} sub="became event" />
          <StatCard label="Rejected" value={ls.rejected} />
          <StatCard label="This week" value={ls.lastWeek} sub="new leads" />
        </div>
      </section>

      {/* Review performance */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Review performance (last 90 days)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Avg review time"
            value={avgReviewHours != null ? `${avgReviewHours}h` : '—'}
            sub="submission → decision"
          />
          <StatCard
            label="Pending decisions"
            value={ls.submitted + ls.underReview}
            sub="submitted + under review"
          />
        </div>
      </section>

      {/* Event library */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Event library
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total events" value={es.total} />
          <StatCard label="Verified" value={es.verified} sub="visible on map" />
          <StatCard label="Active now" value={es.active} sub="ongoing impact" />
        </div>
      </section>
    </div>
  );
}
