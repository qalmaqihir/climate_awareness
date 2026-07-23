import type { Metadata } from 'next';
import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';
import { format } from 'date-fns';
import { getEventStats, getActiveAlerts, getEvents } from '@/lib/queries';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/constants';
import { StatCounter } from '@/components/StatCounter';
import { ShareButtons } from '@/components/ShareButtons';

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['700', '900'],
});

export const metadata: Metadata = {
  title: 'Climate Awareness GB — A verified record of a climate crisis in motion',
  description:
    'Every monsoon, glacial lake outburst floods, flash floods, and landslides devastate Gilgit-Baltistan. We aggregate verified reports on an interactive map to make the crisis visible.',
};

const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://climate-gb.qalmaq.cloud';

export default async function HomePage() {
  let stats = { total: 0, verified: 0, last30: 0 };
  let recentEvents: Awaited<ReturnType<typeof getEvents>> = [];
  let alertCount = 0;

  try {
    const [s, alerts, events] = await Promise.all([
      getEventStats(),
      getActiveAlerts(20),
      getEvents({ status: 'verified' }, 3),
    ]);
    stats = s;
    alertCount = alerts.length;
    recentEvents = events;
  } catch {
    // DB offline — show zeros
  }

  const shareText =
    stats.last30 > 0
      ? `Gilgit-Baltistan recorded ${stats.last30} verified climate events in the last 30 days. Track GLOF alerts + flood impacts:`
      : 'Track verified GLOF events, floods, and disaster alerts across Gilgit-Baltistan, Pakistan:';

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        {/* Topographic background lines */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {[80, 140, 200, 260, 320, 380, 440, 500].map((r, i) => (
            <ellipse
              key={i}
              cx="60%"
              cy="55%"
              rx={r * 2}
              ry={r}
              fill="none"
              stroke="#0f766e"
              strokeWidth="1"
            />
          ))}
          {[60, 110, 160, 210, 260].map((r, i) => (
            <ellipse
              key={`b${i}`}
              cx="20%"
              cy="80%"
              rx={r * 1.5}
              ry={r * 0.7}
              fill="none"
              stroke="#0f766e"
              strokeWidth="0.8"
            />
          ))}
        </svg>

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
            Gilgit-Baltistan · Pakistan · Monsoon {new Date().getFullYear()}
          </p>

          <h1
            className={`${playfair.className} mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl`}
          >
            The glaciers break.
            <br />
            <span className="text-teal-700">The world should know.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
            Every monsoon, glacial lake outburst floods, flash floods, and landslides destroy
            villages across Gilgit-Baltistan. This site aggregates{' '}
            <strong className="font-semibold text-slate-800">verified reports</strong> on an
            interactive map — so the crisis becomes visible to media, organisations, policy makers,
            and the diaspora.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              Explore the map →
            </Link>
            {alertCount > 0 && (
              <Link
                href="/alerts"
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {alertCount} active alert{alertCount !== 1 ? 's' : ''}
              </Link>
            )}
            {alertCount === 0 && (
              <Link
                href="/alerts"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Current alerts
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-900 py-12">
        <div className="mx-auto max-w-4xl px-4">
          <p className="mb-8 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Live data — updated continuously
          </p>
          <div className="grid grid-cols-3 gap-8">
            <StatCounter value={stats.verified} label="Events verified" />
            <StatCounter value={stats.last30} label="Events (30 days)" />
            <StatCounter value={alertCount} label="Active alerts" />
          </div>
          <p className="mt-8 text-center text-xs text-slate-600">
            Data sourced from PMD, PDMA GB, NDMA, Pamir Times, Ibex Media Network, and ICIMOD.
          </p>
        </div>
      </section>

      {/* ── Recent Events ─────────────────────────────────────────────── */}
      {recentEvents.length > 0 && (
        <section className="border-b border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className={`${playfair.className} text-2xl font-bold text-slate-900 sm:text-3xl`}>
                Latest verified events
              </h2>
              <Link href="/map" className="text-sm font-medium text-teal-700 hover:underline">
                View all on map →
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: EVENT_TYPE_COLORS[event.eventType] ?? '#6b7280',
                      }}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                    </span>
                  </div>
                  <h3 className="flex-1 text-sm font-semibold leading-snug text-slate-800 group-hover:text-teal-700">
                    {event.title}
                  </h3>
                  <p className="mt-3 text-xs text-slate-400">
                    {event.district ?? 'GB'} · {format(event.reportedAt, 'MMM d, yyyy')}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Share strip ───────────────────────────────────────────────── */}
      <section className="border-b border-amber-200 bg-amber-50 py-12">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Help spread awareness
          </p>
          <h2
            className={`${playfair.className} mt-2 text-2xl font-bold text-slate-900 sm:text-3xl`}
          >
            Every share puts GB on the map.
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Share this site with journalists, NGOs, policy makers, or anyone who needs to understand
            what&apos;s happening in Gilgit-Baltistan.
          </p>
          <div className="mt-6">
            <ShareButtons url={SITE_URL} text={shareText} />
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Suggested hashtags:{' '}
            <span className="font-mono">#GilgitBaltistan #GLOF #ClimateAction #Pakistan</span>
          </p>
        </div>
      </section>

      {/* ── Open data strip ───────────────────────────────────────────── */}
      <section className="bg-slate-50 py-10">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Open data
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                All verified event data is free to download and reuse.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/events"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                download
              >
                ↓ GeoJSON
              </a>
              <a
                href="/api/events/csv"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                download
              >
                ↓ CSV
              </a>
              <Link
                href="/take-action"
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Take action →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
