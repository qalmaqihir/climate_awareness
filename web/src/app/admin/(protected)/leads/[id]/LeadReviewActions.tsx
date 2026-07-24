'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LeadState, EventType, LocationPrecision } from '@/lib/schema';
import { LEAD_STATE_LABELS } from '@/lib/leads-state';
import { EVENT_TYPE_LABELS, SEVERITY_LABELS } from '@/lib/constants';

interface LeadSnapshot {
  id: number;
  state: LeadState;
  title: string;
  description: string;
  eventType: EventType | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: LocationPrecision | null;
  occurredAt: Date | string | null;
  publishedEventId: number | null;
}

// ─── Transition button ────────────────────────────────────────────────────────

function TransitionButton({
  leadId,
  toState,
  label,
  requireRationale = false,
  variant = 'secondary',
}: {
  leadId: number;
  toState: LeadState;
  label: string;
  requireRationale?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);

  const variantCls = {
    primary: 'bg-teal-700 text-white hover:bg-teal-800',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100',
  }[variant];

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: toState, rationale: rationale || undefined }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(typeof json.error === 'string' ? json.error : 'Request failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }

  if (requireRationale && !showRationale) {
    return (
      <button
        onClick={() => setShowRationale(true)}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${variantCls}`}
      >
        {label}
      </button>
    );
  }

  if (requireRationale && showRationale) {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Rationale (required for audit log)"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={loading || !rationale.trim()}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : `Confirm ${LEAD_STATE_LABELS[toState]}`}
          </button>
          <button
            onClick={() => {
              setShowRationale(false);
              setRationale('');
              setError(null);
            }}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${variantCls}`}
      >
        {loading ? 'Saving…' : label}
      </button>
    </div>
  );
}

// ─── Publish form ─────────────────────────────────────────────────────────────

function PublishForm({ lead }: { lead: LeadSnapshot }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDate = lead.occurredAt
    ? new Date(lead.occurredAt).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement)?.value;

    const latRaw = get('latitude');
    const lngRaw = get('longitude');
    const body = {
      title: get('title'),
      description: get('description') || undefined,
      eventType: get('eventType'),
      eventSubtype: get('eventSubtype') || undefined,
      severity: get('severity'),
      district: get('district') || undefined,
      locationName: get('locationName') || undefined,
      locationPrecision: get('locationPrecision'),
      locationRationale: get('locationRationale') || undefined,
      latitude: latRaw ? parseFloat(latRaw) : undefined,
      longitude: lngRaw ? parseFloat(lngRaw) : undefined,
      reportedAt: get('reportedAt') + ':00Z',
      rationale: get('rationale'),
    };

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; eventId?: number };
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Publish failed');
        return;
      }
      router.push(`/admin/events/${json.eventId}/edit`);
    } catch {
      setError('Network error — please retry');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
      >
        Publish as new event ▼
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4"
    >
      <p className="text-xs font-semibold text-teal-800">
        Create event from lead — event starts as &apos;unverified&apos;; verify in Events admin.
      </p>

      {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Title *</label>
        <input
          name="title"
          required
          defaultValue={lead.title}
          maxLength={300}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
        <textarea
          name="description"
          defaultValue={lead.description}
          rows={3}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Event type *</label>
          <select
            name="eventType"
            required
            defaultValue={lead.eventType ?? ''}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">Select…</option>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Subtype</label>
          <select
            name="eventSubtype"
            defaultValue=""
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">None</option>
            <option value="flash_flood">Flash flood</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Severity</label>
          <select
            name="severity"
            defaultValue="moderate"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          >
            {(Object.keys(SEVERITY_LABELS) as string[]).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">District</label>
          <input
            name="district"
            defaultValue={lead.district ?? ''}
            maxLength={100}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Latitude</label>
          <input
            name="latitude"
            type="number"
            step="any"
            defaultValue={lead.latitude ?? ''}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Longitude</label>
          <input
            name="longitude"
            type="number"
            step="any"
            defaultValue={lead.longitude ?? ''}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Precision</label>
          <select
            name="locationPrecision"
            defaultValue={lead.locationPrecision ?? 'pending'}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
          >
            {(['exact', 'approximate', 'district', 'pending'] as LocationPrecision[]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">Reported at (UTC) *</label>
        <input
          name="reportedAt"
          type="datetime-local"
          required
          defaultValue={defaultDate}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          Publish rationale * (recorded in audit log)
        </label>
        <textarea
          name="rationale"
          required
          rows={2}
          placeholder="Why is this being published? Source quality, verification method, etc."
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {loading ? 'Publishing…' : 'Publish event'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Action panel (state-driven) ──────────────────────────────────────────────

export function LeadReviewActions({ lead }: { lead: LeadSnapshot }) {
  const state = lead.state;

  if (state === 'published') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-500">Lead published.</p>
        {lead.publishedEventId && (
          <a
            href={`/admin/events/${lead.publishedEventId}/edit`}
            className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            View event #{lead.publishedEventId} →
          </a>
        )}
      </div>
    );
  }

  if (state === 'rejected' || state === 'archived') {
    return (
      <p className="text-xs text-slate-400">
        {LEAD_STATE_LABELS[state]} — no further actions available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Claim / re-claim */}
      {(state === 'submitted' || state === 'needs_clarification') && (
        <TransitionButton
          leadId={lead.id}
          toState="under_review"
          label={state === 'needs_clarification' ? 'Re-claim for review' : 'Claim for review'}
          variant="primary"
        />
      )}

      {/* Publish (only from under_review) */}
      {state === 'under_review' && <PublishForm lead={lead} />}

      {/* Needs clarification (only from under_review) */}
      {state === 'under_review' && (
        <TransitionButton
          leadId={lead.id}
          toState="needs_clarification"
          label="Request more info"
          requireRationale
          variant="secondary"
        />
      )}

      {/* Archive (spam / housekeeping — from under_review only) */}
      {state === 'under_review' && (
        <TransitionButton
          leadId={lead.id}
          toState="archived"
          label="Archive (no audit)"
          variant="secondary"
        />
      )}

      {/* Reject (from submitted, needs_clarification, or under_review) */}
      {(state === 'submitted' || state === 'needs_clarification' || state === 'under_review') && (
        <TransitionButton
          leadId={lead.id}
          toState="rejected"
          label="Reject lead"
          requireRationale
          variant="danger"
        />
      )}
    </div>
  );
}
