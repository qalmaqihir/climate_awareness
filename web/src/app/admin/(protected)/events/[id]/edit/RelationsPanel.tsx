'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const RELATION_TYPE_LABELS: Record<string, string> = {
  duplicate: 'Duplicate',
  related: 'Related',
  supersedes: 'Supersedes',
};

interface RelatedEvent {
  id: number;
  title: string;
  eventType: string;
  state: string;
  district: string | null;
}

interface Relation {
  id: number;
  relationType: string;
  note: string | null;
  related: RelatedEvent;
}

export function RelationsPanel({ eventId }: { eventId: number }) {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState('related');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchRelations = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/events/${eventId}/relations`)
      .then((r) => r.json() as Promise<{ relations: Relation[] }>)
      .then((data) => setRelations(data.relations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const target = parseInt(targetId);
    if (isNaN(target)) return;
    setError(null);
    setAdding(true);
    const res = await fetch(`/api/admin/events/${eventId}/relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetEventId: target,
        relationType: relType,
        note: note || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setAdding(false);
    if (!res.ok) {
      setError(json.error ?? 'Failed to link event');
      return;
    }
    setTargetId('');
    setNote('');
    fetchRelations();
  }

  async function handleRemove(relationId: number) {
    if (!confirm('Remove this relation?')) return;
    await fetch(`/api/admin/events/${eventId}/relations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationId }),
    });
    fetchRelations();
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Related events</h2>

      {loading && <p className="mb-3 text-sm text-slate-400">Loading…</p>}

      {!loading && relations.length === 0 && (
        <p className="mb-4 text-sm text-slate-400">No relations yet.</p>
      )}

      {!loading && relations.length > 0 && (
        <div className="mb-4 space-y-2">
          {relations.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div>
                <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {RELATION_TYPE_LABELS[r.relationType] ?? r.relationType}
                </span>
                <Link
                  href={`/admin/events/${r.related.id}/edit`}
                  className="text-sm text-teal-700 hover:underline"
                >
                  #{r.related.id} {r.related.title}
                </Link>
                {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
              </div>
              <button
                onClick={() => handleRemove(r.id)}
                className="ml-3 flex-shrink-0 text-xs text-red-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            required
            placeholder="Target event ID"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          />
          <select
            value={relType}
            onChange={(e) => setRelType(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          >
            {Object.entries(RELATION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Optional note…"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding || !targetId}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {adding ? 'Linking…' : 'Link event'}
        </button>
      </form>
    </div>
  );
}
