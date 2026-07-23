import type { Metadata } from 'next';
import { format } from 'date-fns';
import { Playfair_Display } from 'next/font/google';
import { getActiveAlerts } from '@/lib/queries';

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['700'] });

export const metadata: Metadata = {
  title: 'Current Alerts',
  description:
    'Live GLOF, flash flood, and weather advisories from PMD, PDMA GB, and NDMA for Gilgit-Baltistan.',
};

export const dynamic = 'force-dynamic';

const LEVEL_CONFIG = {
  emergency: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700', label: 'EMERGENCY' },
  warning: {
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-600',
    label: 'WARNING',
  },
  watch: { bg: 'bg-amber-400', text: 'text-amber-900', border: 'border-amber-500', label: 'WATCH' },
  advisory: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    label: 'ADVISORY',
  },
} as const;

type AlertLevel = keyof typeof LEVEL_CONFIG;
const LEVEL_ORDER: AlertLevel[] = ['emergency', 'warning', 'watch', 'advisory'];

export default async function AlertsPage() {
  let alerts: Awaited<ReturnType<typeof getActiveAlerts>> = [];

  try {
    alerts = await getActiveAlerts(50);
  } catch {
    // DB offline
  }

  // Group by level
  const grouped = LEVEL_ORDER.reduce(
    (acc, level) => {
      acc[level] = alerts.filter((a) => a.level === level);
      return acc;
    },
    {} as Record<AlertLevel, typeof alerts>,
  );

  const hasAny = alerts.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700">
        Gilgit-Baltistan · Live feed
      </p>
      <h1 className={`${playfair.className} mt-2 text-3xl font-bold text-slate-900 sm:text-4xl`}>
        Current alerts
      </h1>
      <p className="mt-2 text-slate-600">
        Advisories from PMD, PDMA GB, and NDMA. Page refreshes on each visit.
      </p>

      {!hasAny && (
        <div className="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <p className="text-2xl">✓</p>
          <p className="mt-2 font-semibold text-emerald-800">No active alerts</p>
          <p className="mt-1 text-sm text-emerald-700">
            Check{' '}
            <a
              href="https://www.pmd.gov.pk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              PMD
            </a>{' '}
            or{' '}
            <a
              href="https://ndma.gov.pk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              NDMA
            </a>{' '}
            directly for the latest.
          </p>
          <p className="mt-4 text-xs text-emerald-600">
            Alerts refresh automatically when the worker cron runs (every hour).
          </p>
        </div>
      )}

      {LEVEL_ORDER.filter((l) => grouped[l].length > 0).map((level) => {
        const cfg = LEVEL_CONFIG[level];
        return (
          <div key={level} className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-widest ${cfg.bg} ${cfg.text}`}
              >
                {cfg.label}
              </span>
              <span className="text-xs text-slate-400">
                {grouped[level].length} alert{grouped[level].length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {grouped[level].map((alert) => (
                <article
                  key={alert.id}
                  className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ${cfg.border}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-semibold text-slate-900">{alert.title}</h2>
                    <time
                      className="flex-shrink-0 text-xs text-slate-400"
                      dateTime={alert.issuedAt.toISOString()}
                    >
                      {format(alert.issuedAt, 'MMM d, HH:mm')}
                    </time>
                  </div>

                  {alert.district && (
                    <p className="mt-1 text-xs font-medium text-slate-500">📍 {alert.district}</p>
                  )}

                  {alert.body && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{alert.body}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {alert.expiresAt && (
                      <p className="text-xs text-slate-400">
                        Expires {format(alert.expiresAt, 'MMM d, yyyy HH:mm')}
                      </p>
                    )}
                    {alert.sourceUrl && (
                      <a
                        href={alert.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-700 hover:underline"
                      >
                        Source ↗
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}

      {/* Official links */}
      <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Official alert sources</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {[
            {
              name: 'PMD — Pakistan Meteorological Department',
              url: 'https://www.pmd.gov.pk/en/warnings/',
            },
            {
              name: 'NDMA Pakistan — Situation Reports',
              url: 'https://ndma.gov.pk/situation-reports/',
            },
            { name: 'PDMA GB — Provincial Disaster Authority', url: 'https://pdma.gob.pk' },
          ].map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-teal-700 hover:underline"
              >
                {s.name} ↗
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        See something missing?{' '}
        <a href="mailto:info@naseyou.nl" className="text-teal-700 hover:underline">
          Report it →
        </a>
      </p>
    </div>
  );
}
