import { type NextRequest, NextResponse } from 'next/server';
import { getEvents } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const types = searchParams.get('type')?.split(',').filter(Boolean);
  const districts = searchParams.get('district')?.split(',').filter(Boolean);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;

  let rows;
  try {
    rows = await getEvents({ types, districts, from, to, status: 'verified' });
  } catch {
    return NextResponse.json(
      { type: 'FeatureCollection', features: [] },
      { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }

  const geojson = {
    type: 'FeatureCollection',
    features: rows
      .filter((e) => e.latitude != null && e.longitude != null)
      .map((e) => ({
        type: 'Feature',
        id: e.id,
        geometry: { type: 'Point', coordinates: [e.longitude!, e.latitude!] },
        properties: {
          id: e.id,
          title: e.title,
          eventType: e.eventType,
          severity: e.severity,
          district: e.district,
          locationName: e.locationName,
          reportedAt: e.reportedAt.toISOString(),
          sourceUrl: e.sourceUrl,
          affectedCount: e.affectedCount,
        },
      })),
  };

  return NextResponse.json(geojson, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
