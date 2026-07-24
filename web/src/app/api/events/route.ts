import { type NextRequest, NextResponse } from 'next/server';
import { CANONICAL_EVENT_TYPES, GB_DISTRICTS, isWithinCoverage } from '@/lib/constants';
import { getEvents } from '@/lib/queries';

export const dynamic = 'force-dynamic';

// Maximum number of events returned per request to keep payload compact.
const MAX_RESULTS = 500;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // ── type filter (server-side, validated against canonical set) ──────────────
  const rawTypes = searchParams.get('types')?.split(',').filter(Boolean) ?? [];
  const types = rawTypes.filter((t) => (CANONICAL_EVENT_TYPES as readonly string[]).includes(t));
  if (rawTypes.length > 0 && types.length === 0) {
    return NextResponse.json({ error: 'No valid event types provided' }, { status: 400 });
  }

  // ── district filter (server-side, validated against GB district list) ───────
  const rawDistricts = searchParams.get('districts')?.split(',').filter(Boolean) ?? [];
  const districts = rawDistricts.filter((d) => (GB_DISTRICTS as readonly string[]).includes(d));
  if (rawDistricts.length > 0 && districts.length === 0) {
    return NextResponse.json({ error: 'No valid districts provided' }, { status: 400 });
  }

  // ── date range ───────────────────────────────────────────────────────────────
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;

  if (from && isNaN(from.getTime())) {
    return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
  }
  if (to && isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: 'from must be before to' }, { status: 400 });
  }

  // ── state filter (active / resolved) ────────────────────────────────────────
  const stateParam = searchParams.get('state');
  const state = stateParam === 'active' || stateParam === 'resolved' ? stateParam : undefined;

  // ── full-text search ─────────────────────────────────────────────────────────
  const searchRaw = searchParams.get('q')?.trim().slice(0, 200) ?? '';
  const search = searchRaw || undefined;

  let rows;
  try {
    rows = await getEvents(
      {
        types: types.length ? types : undefined,
        districts: districts.length ? districts : undefined,
        from,
        to,
        status: 'verified',
        state,
        search,
      },
      MAX_RESULTS,
    );
  } catch {
    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  }

  // ── build compact GeoJSON ────────────────────────────────────────────────────
  // Point layer: exclude pending-precision events (appear in feed only).
  // Never include: description, embedHtml, locationRationale, raw sourceUrl.
  const mapFeatures = rows
    .filter(
      (e) =>
        e.latitude != null &&
        e.longitude != null &&
        e.locationPrecision !== 'pending' &&
        e.locationPrecision != null &&
        isWithinCoverage(e.latitude, e.longitude),
    )
    .map((e) => ({
      type: 'Feature' as const,
      id: e.id,
      geometry: { type: 'Point' as const, coordinates: [e.longitude!, e.latitude!] },
      properties: {
        id: e.id,
        title: e.title,
        eventType: e.eventType,
        eventSubtype: e.eventSubtype ?? null,
        severity: e.severity,
        state: e.state,
        district: e.district ?? null,
        locationName: e.locationName ?? null,
        locationPrecision: e.locationPrecision,
        reportedAt: e.reportedAt.toISOString(),
        affectedCount: e.affectedCount ?? null,
        // boolean flag — never expose the raw URL in compact GeoJSON
        evidenceAvailable: Boolean(e.sourceUrl),
      },
    }));

  // Feed list: includes pending-precision events (no geometry).
  // Used by the recent feed sidebar to show all verified incidents.
  const feedItems = rows.map((e) => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    eventSubtype: e.eventSubtype ?? null,
    severity: e.severity,
    state: e.state,
    district: e.district ?? null,
    locationName: e.locationName ?? null,
    locationPrecision: e.locationPrecision ?? 'pending',
    reportedAt: e.reportedAt.toISOString(),
    affectedCount: e.affectedCount ?? null,
    evidenceAvailable: Boolean(e.sourceUrl),
    // include coordinates for feed items that have them (used to fly-to on select)
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
  }));

  const geojson = {
    type: 'FeatureCollection' as const,
    features: mapFeatures,
    // feed is alongside GeoJSON so one request serves both map and sidebar
    meta: {
      total: rows.length,
      mapVisible: mapFeatures.length,
      feedItems,
    },
  };

  return NextResponse.json(geojson, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
