/**
 * Admin alerts management page.
 *
 * Shows all alerts with AI confidence scores and override controls.
 * Refreshes after override via router.refresh().
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';

interface AlertRow {
  id: number;
  title: string;
  body: string;
  level: string;
  district: string | null;
  sourceUrl: string | null;
  isActive: boolean;
  issuedAt: string;
  aiConfidence: number | null;
  aiSummary: string | null;
  aiVerified: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  emergency: 'bg-red-100 text-red-800',
  warning: 'bg-orange-100 text-orange-800',
  watch: 'bg-yellow-100 text-yellow-800',
  advisory: 'bg-blue-100 text-blue-800',
};

function ConfidenceBadge({ score, verified }: { score: number | null; verified: boolean }) {
  if (!verified) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        Pending AI
      </span>
    );
  }
  if (score === null) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        N/A
      </span>
    );
  }

  const color =
    score >= 80
      ? 'bg-emerald-100 text-emerald-800'
      : score >= 50
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-700';

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>AI {score}%</span>
  );
}

function OverrideButtons({
  alertId,
  onOverride,
}: {
  alertId: number;
  onOverride: (id: number, action: 'verify' | 'suppress') => Promise<void>;
}) {
  const [loading, setLoading] = useState<'verify' | 'suppress' | null>(null);

  async function handle(action: 'verify' | 'suppress') {
    setLoading(action);
    await onOverride(alertId, action);
    setLoading(null);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handle('verify')}
        disabled={loading !== null}
        className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
      >
        {loading === 'verify' ? '…' : '✓ Verify'}
      </button>
      <button
        onClick={() => handle('suppress')}
        disabled={loading !== null}
        className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
      >
        {loading === 'suppress' ? '…' : '✕ Suppress'}
      </button>
    </div>
  );
}

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'suppressed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrideError, setOverrideError] = useState('');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url =
        filter === 'pending'
          ? '/api/admin/alerts?pendingReview=1'
          : filter === 'active'
            ? '/api/admin/alerts?active=1'
            : filter === 'suppressed'
              ? '/api/admin/alerts?suppressed=1'
              : '/api/admin/alerts';

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { alerts: AlertRow[] };
      setAlerts(data.alerts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  async function handleOverride(alertId: number, action: 'verify' | 'suppress') {
    setOverrideError('');
    try {
      const res = await fetch(`/api/admin/alerts/${alertId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setOverrideError(data.error ?? 'Override failed');
        return;
      }
      // Refresh the list after override
      await loadAlerts();
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Override failed');
    }
  }

  const pendingCount = alerts.filter(
    (a) =>
      a.aiVerified &&
      a.aiConfidence !== null &&
      a.aiConfidence >= 50 &&
      a.aiConfidence <= 79 &&
      a.isActive,
  ).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          {pendingCount > 0 && (
            <p className="mt-0.5 text-sm text-amber-600">
              {pendingCount} alert{pendingCount > 1 ? 's' : ''} pending human review
            </p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        {(['all', 'pending', 'active', 'suppressed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              filter === f
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {f === 'pending' ? `Pending review${pendingCount > 0 ? ` (${pendingCount})` : ''}` : f}
          </button>
        ))}
      </div>

      {overrideError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {overrideError}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-500">{error}</p>
      ) : alerts.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No alerts in this view.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Level / Region</th>
                <th className="px-4 py-3">AI Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <tr key={alert.id} className={!alert.isActive ? 'opacity-50' : ''}>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-slate-800">{alert.title}</p>
                    {alert.aiSummary && (
                      <p className="mt-0.5 truncate text-xs text-slate-400">{alert.aiSummary}</p>
                    )}
                    {alert.sourceUrl && (
                      <a
                        href={alert.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:underline"
                      >
                        Source ↗
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${LEVEL_COLORS[alert.level] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {alert.level}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">{alert.district ?? 'GB-wide'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge score={alert.aiConfidence} verified={alert.aiVerified} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        alert.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500',
                      ].join(' ')}
                    >
                      {alert.isActive ? 'active' : 'suppressed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {format(new Date(alert.issuedAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <OverrideButtons alertId={alert.id} onOverride={handleOverride} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
