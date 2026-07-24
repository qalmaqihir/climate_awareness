'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  GB_DISTRICTS,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  LOCATION_PRECISION_LABELS,
  INCIDENT_STATE_LABELS,
} from '@/lib/constants';
import type { EventType, EventSeverity } from '@/lib/schema';

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as EventType[];
const SEVERITIES: EventSeverity[] = ['low', 'moderate', 'high', 'critical'];

interface FormState {
  title: string;
  description: string;
  eventType: EventType;
  eventSubtype: string;
  severity: EventSeverity;
  status: 'verified' | 'unverified' | 'disputed' | 'archived';
  state: 'active' | 'resolved';
  district: string;
  locationName: string;
  locationPrecision: string;
  locationRationale: string;
  latitude: string;
  longitude: string;
  sourceUrl: string;
  embedHtml: string;
  affectedCount: string;
  reportedAt: string;
}

export default function EditEventPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((e) => {
        setForm({
          title: e.title ?? '',
          description: e.description ?? '',
          eventType: e.eventType ?? 'flood',
          eventSubtype: e.eventSubtype ?? '',
          severity: e.severity ?? 'moderate',
          status: e.status ?? 'unverified',
          state: e.state ?? 'active',
          district: e.district ?? '',
          locationName: e.locationName ?? '',
          locationPrecision: e.locationPrecision ?? 'pending',
          locationRationale: e.locationRationale ?? '',
          latitude: e.latitude != null ? String(e.latitude) : '',
          longitude: e.longitude != null ? String(e.longitude) : '',
          sourceUrl: e.sourceUrl ?? '',
          embedHtml: e.embedHtml ?? '',
          affectedCount: e.affectedCount != null ? String(e.affectedCount) : '',
          // Treat stored UTC timestamp as UTC for the datetime-local input
          reportedAt: e.reportedAt ? new Date(e.reportedAt).toISOString().slice(0, 16) : '',
        });
      })
      .catch((err: Error) => setLoadError(err.message ?? 'Failed to load event'));
  }, [id]);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => (p ? { ...p, [field]: e.target.value } : p));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitLoading(true);
    setSubmitError('');

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      eventType: form.eventType,
      eventSubtype: form.eventSubtype || undefined,
      severity: form.severity,
      status: form.status,
      state: form.state,
      district: form.district || undefined,
      locationName: form.locationName || undefined,
      locationPrecision: form.locationPrecision,
      locationRationale: form.locationRationale || undefined,
      sourceUrl: form.sourceUrl || undefined,
      embedHtml: form.embedHtml || undefined,
      affectedCount: form.affectedCount ? parseInt(form.affectedCount) : undefined,
      // Append :00Z so datetime-local string is treated as UTC, not local time
      reportedAt: new Date(form.reportedAt + ':00Z').toISOString(),
    };

    // Only include coordinates when both are set
    if (form.latitude && form.longitude) {
      payload.latitude = parseFloat(form.latitude);
      payload.longitude = parseFloat(form.longitude);
    }

    const res = await fetch(`/api/admin/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSubmitLoading(false);

    if (!res.ok) {
      setSubmitError(JSON.stringify(data.error ?? 'Failed to update event'));
      return;
    }

    router.push('/admin/events');
    router.refresh();
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load event: {loadError}
        </p>
        <a
          href="/admin/events"
          className="mt-4 inline-block text-sm text-slate-500 hover:underline"
        >
          ← Back to events
        </a>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-slate-400">Loading event…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Edit event</h1>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
        {submitError && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Title *">
            <input
              required
              value={form.title}
              onChange={set('title')}
              className={inputClass}
              placeholder="GLOF alert: Shisper Glacier lake breached…"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={set('description')}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Event type *">
              <select
                required
                value={form.eventType}
                onChange={(e) => {
                  const t = e.target.value as EventType;
                  setForm((p) => (p ? { ...p, eventType: t, eventSubtype: '' } : p));
                }}
                className={inputClass}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Subtype">
              <select
                value={form.eventSubtype}
                onChange={set('eventSubtype')}
                disabled={form.eventType !== 'flood'}
                className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
              >
                <option value="">— None —</option>
                {Object.entries(EVENT_SUBTYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Severity *">
              <select
                required
                value={form.severity}
                onChange={set('severity')}
                className={inputClass}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Verification status">
              <select value={form.status} onChange={set('status')} className={inputClass}>
                <option value="unverified">Unverified</option>
                <option value="verified">Verified</option>
                <option value="disputed">Disputed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>

          <Field label="Incident state">
            <select value={form.state} onChange={set('state')} className={inputClass}>
              {Object.entries(INCIDENT_STATE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Active = acute impact ongoing. Resolved = incident ended.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="District">
              <select value={form.district} onChange={set('district')} className={inputClass}>
                <option value="">— Select —</option>
                {GB_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Location name">
              <input
                value={form.locationName}
                onChange={set('locationName')}
                className={inputClass}
                placeholder="Shisper Glacier, Hunza"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitude (34.5 – 37.5)">
              <input
                type="number"
                step="any"
                min={34.5}
                max={37.5}
                value={form.latitude}
                onChange={set('latitude')}
                className={inputClass}
                placeholder="36.35"
              />
            </Field>

            <Field label="Longitude (70.5 – 77.5)">
              <input
                type="number"
                step="any"
                min={70.5}
                max={77.5}
                value={form.longitude}
                onChange={set('longitude')}
                className={inputClass}
                placeholder="74.73"
              />
            </Field>
          </div>

          <Field label="Location precision *">
            <select
              value={form.locationPrecision}
              onChange={set('locationPrecision')}
              className={inputClass}
            >
              {Object.entries(LOCATION_PRECISION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location rationale (moderator note — not public)">
            <textarea
              rows={2}
              value={form.locationRationale}
              onChange={set('locationRationale')}
              className={inputClass}
              placeholder="Source: ICIMOD GLOF report, Figure 3."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Reported at (UTC) *">
              <input
                required
                type="datetime-local"
                value={form.reportedAt}
                onChange={set('reportedAt')}
                className={inputClass}
              />
            </Field>

            <Field label="Affected count">
              <input
                type="number"
                min={0}
                value={form.affectedCount}
                onChange={set('affectedCount')}
                className={inputClass}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Source URL">
            <input
              type="url"
              value={form.sourceUrl}
              onChange={set('sourceUrl')}
              className={inputClass}
              placeholder="https://pamirtimes.net/…"
            />
          </Field>

          {form.embedHtml && (
            <Field label="Embed HTML (set via oEmbed on new-event form)">
              <textarea
                rows={4}
                value={form.embedHtml}
                readOnly
                className={`${inputClass} cursor-default bg-slate-50 font-mono text-xs`}
              />
            </Field>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitLoading}
            className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitLoading ? 'Saving…' : 'Save changes'}
          </button>
          <a href="/admin/events" className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
