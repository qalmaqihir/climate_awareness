import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { getLeadById } from '@/lib/leads-queries';
import { LEAD_STATE_LABELS, LEAD_STATE_COLORS } from '@/lib/leads-state';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import { LeadReviewActions } from './LeadReviewActions';
import type { LeadState, EventType, LocationPrecision } from '@/lib/schema';

type Props = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const leadId = parseInt(id);
  if (isNaN(leadId)) notFound();

  const lead = await getLeadById(leadId);
  if (!lead) notFound();

  const stateLabel = LEAD_STATE_LABELS[lead.state as LeadState] ?? lead.state;
  const stateColor = LEAD_STATE_COLORS[lead.state as LeadState] ?? '';

  return (
    <div className="max-w-5xl">
      {/* Back */}
      <Link
        href="/admin/leads"
        className="mb-6 inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
      >
        ← Back to queue
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${stateColor}`}>
              {stateLabel}
            </span>
            <span className="text-xs text-slate-400">Lead #{lead.id}</span>
          </div>
          <h1 className="text-xl font-bold leading-snug text-slate-900">{lead.title}</h1>
          <p className="mt-1 text-xs text-slate-400">
            Submitted {format(lead.createdAt, "MMM d, yyyy 'at' HH:mm 'UTC'")} via{' '}
            {lead.intakeChannel}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* ── Left: lead details ── */}
        <div className="space-y-4">
          {/* Description */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Report
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {lead.description}
            </p>
          </section>

          {/* Metadata grid */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Event type</dt>
                <dd className="font-medium text-slate-800">
                  {lead.eventType
                    ? (EVENT_TYPE_LABELS[lead.eventType as EventType] ?? lead.eventType)
                    : '—'}
                  {lead.eventSubtype && (
                    <span className="ml-1 text-xs text-slate-400">({lead.eventSubtype})</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">District</dt>
                <dd className="font-medium text-slate-800">{lead.district ?? '—'}</dd>
              </div>
              {lead.occurredAt && (
                <div>
                  <dt className="text-xs text-slate-400">Occurred at</dt>
                  <dd className="font-medium text-slate-800">
                    {format(lead.occurredAt, 'MMM d, yyyy')}
                  </dd>
                </div>
              )}
              {lead.locationDescription && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Location (submitter wording)</dt>
                  <dd className="font-medium text-slate-800">{lead.locationDescription}</dd>
                </div>
              )}
              {lead.latitude != null && lead.longitude != null && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Coordinates</dt>
                  <dd className="font-medium text-slate-800">
                    {lead.latitude.toFixed(5)}°N, {lead.longitude.toFixed(5)}°E
                    {lead.locationPrecision && (
                      <span className="ml-2 text-xs text-slate-400">
                        ({lead.locationPrecision as LocationPrecision})
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Submitter */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Submitter
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Email</dt>
                <dd className="font-medium text-slate-800">{lead.submitterEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Contact permission</dt>
                <dd className="font-medium text-slate-800">
                  {lead.contactPermission ? 'Yes' : 'No'}
                </dd>
              </div>
              {lead.contactPermission && lead.contactInfo && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Contact info</dt>
                  <dd className="font-medium text-slate-800">{lead.contactInfo}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Evidence */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Evidence ({lead.evidence.length})
            </h2>
            {lead.evidence.length === 0 ? (
              <p className="text-sm text-slate-400">No evidence attached.</p>
            ) : (
              <ul className="space-y-2">
                {lead.evidence.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 text-sm"
                  >
                    <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {ev.evidenceType}
                    </span>
                    <div className="min-w-0">
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-teal-700 hover:underline"
                        >
                          {ev.sourceUrl}
                        </a>
                      )}
                      {ev.description && (
                        <p className="mt-1 text-xs text-slate-500">{ev.description}</p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        Privacy: {ev.privacyState} · Visibility: {ev.reviewerVisibility}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Right: action panel ── */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Review actions
            </h2>
            <LeadReviewActions
              lead={{
                id: lead.id,
                state: lead.state as LeadState,
                title: lead.title,
                description: lead.description,
                eventType: (lead.eventType as EventType) ?? null,
                district: lead.district,
                latitude: lead.latitude,
                longitude: lead.longitude,
                locationPrecision: (lead.locationPrecision as LocationPrecision) ?? null,
                occurredAt: lead.occurredAt,
                publishedEventId: lead.publishedEventId,
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
