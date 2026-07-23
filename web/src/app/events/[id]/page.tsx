import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { getEventById } from '@/lib/queries';
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  INCIDENT_STATE_COLORS,
  LOCATION_PRECISION_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
} from '@/lib/constants';

// Deduplicate the DB lookup between generateMetadata and the page component
const getEventCached = cache(getEventById);

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) return { title: 'Event not found' };
  const event = await getEventCached(parsedId);
  if (!event) return { title: 'Event not found' };
  return {
    title: event.title,
    description:
      event.description ??
      `${EVENT_TYPE_LABELS[event.eventType]} in ${event.district ?? 'Gilgit-Baltistan'}`,
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) notFound();
  const event = await getEventCached(parsedId);

  if (!event) notFound();

  const typeColor = EVENT_TYPE_COLORS[event.eventType] ?? '#6b7280';
  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType;
  const severityLabel = SEVERITY_LABELS[event.severity] ?? event.severity;
  const severityColor = SEVERITY_COLORS[event.severity] ?? '#6b7280';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Back */}
      <Link
        href="/map"
        className="mb-6 inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
      >
        ← Back to map
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: typeColor }}
          >
            {typeLabel}
            {event.eventSubtype && (
              <span className="font-normal opacity-90">
                {' · '}
                {EVENT_SUBTYPE_LABELS[event.eventSubtype] ?? event.eventSubtype}
              </span>
            )}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${severityColor}22`, color: severityColor }}
          >
            {severityLabel} severity
          </span>
          {event.state && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: event.state === 'active' ? '#fee2e2' : '#f1f5f9',
                color: INCIDENT_STATE_COLORS[event.state] ?? '#6b7280',
              }}
            >
              {event.state === 'active' ? 'Active' : 'Resolved'}
            </span>
          )}
          {event.status === 'verified' && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              ✓ Verified
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold leading-snug text-slate-900">{event.title}</h1>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {(event.locationName ?? event.district) && (
            <span>📍 {event.locationName ?? event.district}</span>
          )}
          <span>🕐 Reported {format(event.reportedAt, 'MMMM d, yyyy')}</span>
          {event.affectedCount != null && (
            <span>👥 {event.affectedCount.toLocaleString()} affected</span>
          )}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <p className="mb-6 text-base leading-relaxed text-slate-700">{event.description}</p>
      )}

      {/* oEmbed */}
      {event.embedHtml && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Source post
          </p>
          <div className="oembed-container" dangerouslySetInnerHTML={{ __html: event.embedHtml }} />
        </div>
      )}

      {/* Source attribution — only render for http/https to prevent javascript: URI injection */}
      {event.sourceUrl && /^https?:\/\//i.test(event.sourceUrl) && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Source
          </p>
          {event.sourceName && (
            <p className="mb-2 text-sm font-medium text-slate-700">{event.sourceName}</p>
          )}
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-teal-700 hover:underline"
          >
            {event.sourceUrl.length > 70 ? event.sourceUrl.slice(0, 67) + '…' : event.sourceUrl} ↗
          </a>
        </div>
      )}

      {/* Location coords */}
      {event.latitude != null && event.longitude != null && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium">Coordinates:</span> {event.latitude.toFixed(5)}°N,{' '}
          {event.longitude.toFixed(5)}°E
          {' · '}
          <a
            href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 hover:underline"
          >
            Open in Google Maps ↗
          </a>
          {event.locationPrecision && event.locationPrecision !== 'pending' && (
            <p className="mt-1 text-xs text-slate-400">
              Precision:{' '}
              {LOCATION_PRECISION_LABELS[event.locationPrecision] ?? event.locationPrecision}
            </p>
          )}
        </div>
      )}

      {/* Verification info */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <p>
          Added {format(event.createdAt, "MMM d, yyyy 'at' HH:mm 'UTC'")} ·{' '}
          {event.verifiedAt
            ? `Verified ${format(event.verifiedAt, 'MMM d, yyyy')}`
            : 'Pending verification'}
        </p>
        <p className="mt-1">
          Data issue?{' '}
          <a
            href="mailto:info@qalmaq.cloud?subject=Climate+GB+data+correction"
            className="text-teal-700 hover:underline"
          >
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
