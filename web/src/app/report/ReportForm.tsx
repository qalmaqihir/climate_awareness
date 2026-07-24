'use client';

import { useState } from 'react';
import { GB_DISTRICTS } from '@/lib/constants';
import { EVENT_TYPES } from '@/lib/leads-submission-schema';

const EVENT_TYPE_LABELS: Record<string, string> = {
  glof: 'Glacial Lake Outburst Flood (GLOF)',
  flood: 'Flood',
  landslide: 'Landslide',
  infrastructure_damage: 'Infrastructure Damage',
  casualty: 'Casualty / Injury',
  displacement: 'Displacement',
  other: 'Other',
};

interface SubmitResult {
  id?: number;
  message?: string;
  error?: string;
}

export function ReportForm() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [contactPermission, setContactPermission] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  function fieldErr(name: string) {
    return fieldErrors[name] ? (
      <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>
    ) : null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});
    setLoading(true);

    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement)?.value ?? '';

    const latRaw = get('latitude');
    const lngRaw = get('longitude');

    const body = {
      title: get('title'),
      description: get('description'),
      eventType: get('eventType') || undefined,
      locationDescription: get('locationDescription') || undefined,
      district: get('district') || undefined,
      latitude: latRaw ? parseFloat(latRaw) : undefined,
      longitude: lngRaw ? parseFloat(lngRaw) : undefined,
      occurredAt: get('occurredAt') || undefined,
      sourceUrl: get('sourceUrl') || undefined,
      sourceDescription: get('sourceDescription') || undefined,
      contactPermission,
      contactInfo: contactPermission ? get('contactInfo') || undefined : undefined,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as SubmitResult & {
        issues?: Array<{ path: string[]; message: string }>;
      };

      if (!res.ok) {
        if (res.status === 422 && json.issues) {
          const errs: Record<string, string> = {};
          json.issues.forEach((issue) => {
            const key = issue.path[0] ?? 'general';
            errs[key as string] = issue.message;
          });
          setFieldErrors(errs);
        } else if (res.status === 429) {
          setServerError(json.error ?? 'Rate limit reached — please try again later.');
        } else if (res.status === 401) {
          setServerError('Session expired — please sign in again.');
        } else {
          setServerError(json.error ?? 'Submission failed. Please try again.');
        }
        return;
      }

      setSubmittedId(json.id ?? null);
      setStep('success');
    } catch {
      setServerError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
        <div className="mb-3 text-3xl">✓</div>
        <h2 className="text-lg font-bold text-teal-900">Report received</h2>
        {submittedId && <p className="mt-1 text-xs text-teal-700">Reference #{submittedId}</p>}
        <p className="mt-3 text-sm text-teal-800">
          A moderator will review your report. If clarification is needed, we may reach out using
          the contact details you provided.
        </p>
        <p className="mt-2 text-sm text-teal-800">
          No details of your report appear publicly until a moderator approves publication.
        </p>
        <button
          onClick={() => {
            setStep('form');
            setSubmittedId(null);
          }}
          className="mt-5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Submit another report
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>
      )}

      {/* ── 1. What happened ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          1. What happened? <span className="font-normal text-red-500">*</span>
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          A short title describing the event — one sentence is enough.
        </p>
        <input
          name="title"
          required
          minLength={5}
          maxLength={300}
          placeholder="e.g. GLOF in Shisper valley blocked Hunza road"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        {fieldErr('title')}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Event type (optional)
          </label>
          <select
            name="eventType"
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">Select if known…</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {fieldErr('eventType')}
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Full description — what happened, who/what was affected, is it ongoing?{' '}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={4000}
            rows={5}
            placeholder="Describe the event in as much detail as you have. Include who or what was affected, the scale of impact, and whether the situation is still ongoing."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
          />
          {fieldErr('description')}
        </div>
      </section>

      {/* ── 2. When ───────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">2. When did it happen?</h2>
        <p className="mb-3 text-xs text-slate-500">
          Approximate date is fine. Leave blank if unknown.
        </p>
        <input
          name="occurredAt"
          type="date"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        {fieldErr('occurredAt')}
      </section>

      {/* ── 3. Where ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">3. Where did it happen?</h2>
        <p className="mb-3 text-xs text-slate-500">
          Describe the location in your own words — a valley, village, bridge, or landmark name is
          useful. Coordinates and district are optional.
        </p>

        <textarea
          name="locationDescription"
          maxLength={500}
          rows={2}
          placeholder="e.g. Shisper Glacier snout, above Hasanabad, Hunza"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        {fieldErr('locationDescription')}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            District (optional)
          </label>
          <select
            name="district"
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">Select district…</option>
            {GB_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Latitude (optional)
            </label>
            <input
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              placeholder="36.3167"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
            {fieldErr('latitude')}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Longitude (optional)
            </label>
            <input
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="74.6500"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
            {fieldErr('longitude')}
          </div>
        </div>
      </section>

      {/* ── 6. Source + contact (optional) ───────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          4. Source or evidence (optional)
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          A news link, social post, or other source you found. Only visible to moderators.
        </p>

        <input
          name="sourceUrl"
          type="url"
          maxLength={1000}
          placeholder="https://…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        {fieldErr('sourceUrl')}

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Notes on the source (optional)
          </label>
          <textarea
            name="sourceDescription"
            maxLength={500}
            rows={2}
            placeholder="e.g. Local news report; may be unverified"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={contactPermission}
              onChange={(e) => setContactPermission(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">
              A moderator may contact me for clarification
            </span>
          </label>

          {contactPermission && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Best way to reach you (optional)
              </label>
              <input
                name="contactInfo"
                maxLength={500}
                placeholder="Phone number, WhatsApp, or email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
              />
              {fieldErr('contactInfo')}
            </div>
          )}
        </div>
      </section>

      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Your report is private. It will not appear on the public map until a moderator reviews and
        approves publication. Your email address is never shown publicly.
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-teal-700 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? 'Submitting…' : 'Submit report'}
      </button>
    </form>
  );
}
