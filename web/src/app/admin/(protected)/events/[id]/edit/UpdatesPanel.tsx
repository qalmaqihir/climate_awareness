'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

const UPDATE_TYPE_LABELS: Record<string, string> = {
  status: 'Status update',
  correction: 'Correction',
  resolution: 'Resolution',
  severity_change: 'Severity change',
};

interface Update {
  id: number;
  updateText: string;
  updateType: string;
  publishedAt: string;
}

export function UpdatesPanel({ eventId }: { eventId: number }) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [type, setType] = useState('status');
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/events/${eventId}/updates`)
      .then((r) => r.json() as Promise<{ updates: Update[] }>)
      .then((data) => setUpdates(data.updates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const res = await fetch(`/api/admin/events/${eventId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updateText: text, updateType: type }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setAdding(false);
    if (!res.ok) {
      setError(json.error ?? 'Failed to add update');
      return;
    }
    setText('');
    fetchUpdates();
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Incident updates</h2>

      {loading && <p className="mb-3 text-sm text-slate-400">Loading…</p>}

      {!loading && updates.length === 0 && (
        <p className="mb-4 text-sm text-slate-400">No updates yet.</p>
      )}

      {!loading && updates.length > 0 && (
        <div className="mb-4 space-y-2">
          {updates.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium text-teal-700">
                  {UPDATE_TYPE_LABELS[u.updateType] ?? u.updateType}
                </span>
                <span className="text-xs text-slate-400">
                  {format(new Date(u.publishedAt), 'MMM d, yyyy')}
                </span>
              </div>
              <p className="text-sm text-slate-700">{u.updateText}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          >
            {Object.entries(UPDATE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            minLength={5}
            maxLength={2000}
            rows={2}
            placeholder="Update text…"
            className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !text.trim()}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add update'}
        </button>
      </form>
    </div>
  );
}
