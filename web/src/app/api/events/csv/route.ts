import { NextResponse } from 'next/server';
import { getEvents } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  let events: Awaited<ReturnType<typeof getEvents>> = [];

  try {
    events = await getEvents({ status: 'verified' });
  } catch {
    return NextResponse.json({ error: 'DB offline' }, { status: 503 });
  }

  const headers = [
    'id',
    'title',
    'event_type',
    'severity',
    'status',
    'district',
    'location_name',
    'latitude',
    'longitude',
    'affected_count',
    'source_url',
    'reported_at',
    'verified_at',
  ];

  const rows = events.map((e) =>
    [
      escapeCsv(e.id),
      escapeCsv(e.title),
      escapeCsv(e.eventType),
      escapeCsv(e.severity),
      escapeCsv(e.status),
      escapeCsv(e.district),
      escapeCsv(e.locationName),
      escapeCsv(e.latitude),
      escapeCsv(e.longitude),
      escapeCsv(e.affectedCount),
      escapeCsv(e.sourceUrl),
      escapeCsv(e.reportedAt?.toISOString()),
      escapeCsv(e.verifiedAt?.toISOString()),
    ].join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="climate-gb-events-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'public, s-maxage=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
