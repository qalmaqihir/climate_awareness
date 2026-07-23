'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FeatureCollection, Point } from 'geojson';
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { format } from 'date-fns';
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  GB_CENTER,
  GB_DEFAULT_ZOOM,
  GB_DISTRICTS,
  INCIDENT_STATE_COLORS,
  LOCATION_PRECISION_LABELS,
  MAP_STYLE,
  SEVERITY_LABELS,
} from '@/lib/constants';

interface EventProperties {
  id: number;
  title: string;
  eventType: string;
  eventSubtype: string | null;
  severity: string;
  state: string;
  district: string | null;
  locationName: string | null;
  locationPrecision: string | null;
  reportedAt: string;
  affectedCount: number | null;
  evidenceAvailable: boolean;
}

interface FeedItem extends EventProperties {
  latitude: number | null;
  longitude: number | null;
}

interface EventsApiResponse {
  type: 'FeatureCollection';
  features: FeatureCollection['features'];
  meta: { total: number; mapVisible: number; feedItems: FeedItem[] };
}

interface PopupState {
  longitude: number;
  latitude: number;
  properties: EventProperties;
}

interface Filters {
  types: Set<string>;
  districts: Set<string>;
  from: string;
  to: string;
  state: '' | 'active' | 'resolved';
}

const ALL_TYPES = Object.keys(EVENT_TYPE_LABELS);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expr = any;

const TYPE_COLOR_EXPR: Expr = [
  'match',
  ['get', 'eventType'],
  ...Object.entries(EVENT_TYPE_COLORS).flatMap(([k, v]) => [k, v]),
  '#6b7280',
];

const SEVERITY_RADIUS_EXPR: Expr = [
  'match',
  ['get', 'severity'],
  'low',
  7,
  'moderate',
  10,
  'high',
  14,
  'critical',
  19,
  10,
];

const clusterLayer: LayerProps = {
  id: 'events-clusters',
  type: 'circle',
  source: 'events',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#0f766e', 10, '#0369a1', 30, '#7c3aed'],
    'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 30, 36],
    'circle-stroke-width': 3,
    'circle-stroke-color': 'rgba(255,255,255,0.65)',
    'circle-opacity': 0.92,
  },
};

const clusterCountLayer: LayerProps = {
  id: 'events-cluster-count',
  type: 'symbol',
  source: 'events',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-size': 13,
    'text-font': ['Noto Sans Bold'],
  },
  paint: { 'text-color': '#ffffff' },
};

// Blur encodes location uncertainty: exact=sharp, approximate=soft, district=blurred.
const PRECISION_BLUR_EXPR: Expr = [
  'case',
  ['==', ['get', 'locationPrecision'], 'exact'],
  0,
  ['==', ['get', 'locationPrecision'], 'approximate'],
  0.35,
  ['==', ['get', 'locationPrecision'], 'district'],
  0.85,
  0.35,
];

// Opacity reinforces the uncertainty signal.
const PRECISION_OPACITY_EXPR: Expr = [
  'case',
  ['==', ['get', 'locationPrecision'], 'exact'],
  0.9,
  ['==', ['get', 'locationPrecision'], 'approximate'],
  0.78,
  ['==', ['get', 'locationPrecision'], 'district'],
  0.6,
  0.78,
];

// District-level events get a larger footprint to represent the broader area.
const PRECISION_RADIUS_BONUS_EXPR: Expr = [
  'case',
  ['==', ['get', 'locationPrecision'], 'district'],
  5,
  0,
];

const unclusteredLayer: LayerProps = {
  id: 'events-unclustered',
  type: 'circle',
  source: 'events',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': TYPE_COLOR_EXPR,
    'circle-radius': ['+', SEVERITY_RADIUS_EXPR, PRECISION_RADIUS_BONUS_EXPR],
    'circle-stroke-width': ['case', ['==', ['get', 'locationPrecision'], 'exact'], 2.5, 1.5],
    'circle-stroke-color': '#ffffff',
    'circle-blur': PRECISION_BLUR_EXPR,
    'circle-opacity': PRECISION_OPACITY_EXPR,
  },
};

// Red ring badge on top of active-state events so active ≠ resolved is never colour-only.
const activeRingLayer: LayerProps = {
  id: 'events-active-ring',
  type: 'circle',
  source: 'events',
  filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'state'], 'active']],
  paint: {
    'circle-radius': ['+', SEVERITY_RADIUS_EXPR, PRECISION_RADIUS_BONUS_EXPR, 5],
    'circle-color': 'transparent',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#dc2626',
    'circle-opacity': 0,
    'circle-stroke-opacity': 0.85,
  },
};

// ── fetch state reducer ───────────────────────────────────────────────────────
// Using useReducer so dispatch (not useState setter) is called inside effects,
// which satisfies the react-hooks/set-state-in-effect lint rule.

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

type FetchState = {
  loading: boolean;
  error: string | null;
  geojson: FeatureCollection;
  feedItems: FeedItem[];
};

type FetchAction =
  | { type: 'LOAD' }
  | { type: 'SUCCESS'; geojson: FeatureCollection; feedItems: FeedItem[] }
  | { type: 'ERROR'; message: string };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, loading: true, error: null };
    case 'SUCCESS':
      return { loading: false, error: null, geojson: action.geojson, feedItems: action.feedItems };
    case 'ERROR':
      return { ...state, loading: false, error: action.message };
    default:
      return state;
  }
}

function initFilters(searchParams: ReturnType<typeof useSearchParams>): Filters {
  const typesParam = searchParams.get('types');
  const districtsParam = searchParams.get('districts');
  const stateParam = searchParams.get('state');
  return {
    types: typesParam
      ? new Set(typesParam.split(',').filter((t) => ALL_TYPES.includes(t)))
      : new Set(ALL_TYPES),
    districts: districtsParam
      ? new Set(
          districtsParam.split(',').filter((d) => (GB_DISTRICTS as readonly string[]).includes(d)),
        )
      : new Set<string>(),
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    state: (['active', 'resolved'].includes(stateParam ?? '')
      ? stateParam
      : '') as Filters['state'],
  };
}

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => initFilters(searchParams));
  const [fetchState, dispatchFetch] = useReducer(fetchReducer, {
    loading: true,
    error: null,
    geojson: EMPTY_FC,
    feedItems: [],
  });
  const { loading, error, geojson, feedItems } = fetchState;
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync filter state → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.types.size > 0 && filters.types.size < ALL_TYPES.length) {
      params.set('types', [...filters.types].join(','));
    }
    if (filters.districts.size > 0) {
      params.set('districts', [...filters.districts].join(','));
    }
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.state) params.set('state', filters.state);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [filters, pathname, router]);

  // Fetch events when filters change; skip when no types selected (derived to empty below).
  useEffect(() => {
    if (filters.types.size === 0) return;

    const controller = new AbortController();
    dispatchFetch({ type: 'LOAD' });

    const params = new URLSearchParams();
    if (filters.types.size < ALL_TYPES.length) {
      params.set('types', [...filters.types].join(','));
    }
    if (filters.districts.size > 0) {
      params.set('districts', [...filters.districts].join(','));
    }
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.state) params.set('state', filters.state);

    fetch(`/api/events?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json() as Promise<EventsApiResponse>;
      })
      .then((data) => {
        dispatchFetch({
          type: 'SUCCESS',
          geojson: { type: 'FeatureCollection', features: data.features ?? [] },
          feedItems: data.meta?.feedItems ?? [],
        });
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          dispatchFetch({ type: 'ERROR', message: err.message ?? 'Failed to load events' });
        }
      });

    return () => controller.abort();
  }, [filters]);

  // When no types are selected, show empty map and feed without fetching.
  const noTypes = filters.types.size === 0;
  const displayGeojson = useMemo<FeatureCollection>(
    () => (noTypes ? { type: 'FeatureCollection', features: [] } : geojson),
    [noTypes, geojson],
  );
  const displayFeed = noTypes ? [] : feedItems;
  const showLoading = loading && !noTypes;
  const displayError = noTypes ? null : error;

  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: ['events-clusters'] });
    if (clusterFeatures.length > 0) {
      const f = clusterFeatures[0];
      const coords = (f.geometry as Point).coordinates;
      map.easeTo({ center: [coords[0], coords[1]], zoom: map.getZoom() + 2, duration: 400 });
      return;
    }

    const eventFeatures = map.queryRenderedFeatures(e.point, {
      layers: ['events-unclustered', 'events-active-ring'],
    });
    if (eventFeatures.length > 0) {
      const f = eventFeatures[0];
      const coords = (f.geometry as Point).coordinates;
      setPopup({
        longitude: coords[0],
        latitude: coords[1],
        properties: f.properties as EventProperties,
      });
    }
  }, []);

  const handleFeedItemClick = useCallback(
    (item: FeedItem) => {
      if (item.latitude != null && item.longitude != null && item.locationPrecision !== 'pending') {
        mapRef.current?.getMap()?.flyTo({
          center: [item.longitude, item.latitude],
          zoom: 11,
          duration: 800,
        });
        setPopup({
          longitude: item.longitude,
          latitude: item.latitude,
          properties: item,
        });
        setFiltersOpen(false);
      } else {
        router.push(`/events/${item.id}`);
      }
    },
    [router],
  );

  const toggleType = (type: string) => {
    setFilters((prev) => {
      const next = new Set(prev.types);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, types: next };
    });
  };

  const toggleDistrict = (d: string) => {
    setFilters((prev) => {
      const next = new Set(prev.districts);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return { ...prev, districts: next };
    });
  };

  const activeFilterCount =
    (filters.types.size < ALL_TYPES.length ? 1 : 0) +
    filters.districts.size +
    (filters.from || filters.to ? 1 : 0) +
    (filters.state ? 1 : 0);

  return (
    <div className="relative flex h-full w-full">
      {/* Filter toggle — mobile */}
      <button
        className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-md ring-1 ring-slate-200 hover:bg-slate-50 md:hidden"
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <FilterIcon />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-700 text-[10px] text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={[
          'absolute left-0 top-0 z-20 flex h-full w-72 flex-col border-r border-slate-200 bg-white shadow-lg transition-transform duration-200',
          'md:relative md:translate-x-0 md:shadow-none',
          filtersOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Sidebar header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-teal-700 hover:underline"
              onClick={() =>
                setFilters({
                  types: new Set(ALL_TYPES),
                  districts: new Set(),
                  from: '',
                  to: '',
                  state: '',
                })
              }
            >
              Reset
            </button>
            <button
              className="text-slate-400 hover:text-slate-600 md:hidden"
              onClick={() => setFiltersOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter body */}
        <div className="flex-shrink-0 overflow-y-auto border-b border-slate-200 p-4 [max-height:280px] space-y-5">
          {/* Event type */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Event type
            </p>
            <div className="space-y-1.5">
              {ALL_TYPES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.types.has(t)}
                    onChange={() => toggleType(t)}
                    className="sr-only"
                  />
                  <span
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
                    style={{
                      backgroundColor: filters.types.has(t) ? EVENT_TYPE_COLORS[t] : 'transparent',
                      borderColor: EVENT_TYPE_COLORS[t],
                    }}
                  >
                    {filters.types.has(t) && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 12 12"
                      >
                        <path
                          d="M10 3L5 8.5 2 5.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </span>
                  {EVENT_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          {/* District */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              District
            </p>
            <div className="space-y-1.5">
              {GB_DISTRICTS.map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.districts.has(d)}
                    onChange={() => toggleDistrict(d)}
                    className="accent-teal-700"
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Date range
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500">From</label>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">To</label>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* State */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status
            </p>
            <select
              value={filters.state}
              onChange={(e) =>
                setFilters((p) => ({ ...p, state: e.target.value as Filters['state'] }))
              }
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Recent events feed */}
        <div className="flex flex-shrink-0 items-center justify-between bg-slate-50 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent events
          </span>
          <span className="text-xs text-slate-400">
            {showLoading ? '…' : `${displayFeed.length} shown`}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
          {showLoading && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">Loading…</div>
          )}
          {!showLoading && displayError && (
            <div className="px-4 py-6 text-center text-xs text-red-500">{displayError}</div>
          )}
          {!showLoading && !displayError && displayFeed.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              No events match the current filters.
            </div>
          )}
          {!showLoading &&
            !displayError &&
            displayFeed.map((item) => (
              <button
                key={item.id}
                onClick={() => handleFeedItemClick(item)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: EVENT_TYPE_COLORS[item.eventType] ?? '#6b7280' }}
                  />
                  <span className="text-xs text-slate-500">
                    {EVENT_TYPE_LABELS[item.eventType] ?? item.eventType}
                    {item.eventSubtype &&
                      ` · ${EVENT_SUBTYPE_LABELS[item.eventSubtype] ?? item.eventSubtype}`}
                  </span>
                  {item.state === 'active' && (
                    <span className="ml-auto rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                      Active
                    </span>
                  )}
                  {item.locationPrecision === 'pending' && (
                    <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
                      Location pending
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-medium text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {item.district ?? 'GB'} · {format(new Date(item.reportedAt), 'MMM d, yyyy')}
                </p>
              </button>
            ))}
        </div>
      </aside>

      {/* Map */}
      <div className="relative flex-1">
        {/* Filter toggle — desktop */}
        {!filtersOpen && (
          <button
            className="absolute top-3 left-3 z-10 hidden items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-md ring-1 ring-slate-200 hover:bg-slate-50 md:flex"
            onClick={() => setFiltersOpen(true)}
          >
            <FilterIcon /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-teal-700 px-1.5 py-0.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {showLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <span className="text-sm text-slate-500">Loading events…</span>
          </div>
        )}

        {displayError && !showLoading && (
          <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 shadow">
            {displayError}
          </div>
        )}

        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          initialViewState={{
            longitude: GB_CENTER.lng,
            latitude: GB_CENTER.lat,
            zoom: GB_DEFAULT_ZOOM,
          }}
          style={{ width: '100%', height: '100%' }}
          onClick={handleMapClick}
          cursor="pointer"
          interactiveLayerIds={['events-clusters', 'events-unclustered', 'events-active-ring']}
        >
          <NavigationControl position="top-right" />

          <Source
            id="events"
            type="geojson"
            data={displayGeojson}
            cluster={true}
            clusterMaxZoom={13}
            clusterRadius={50}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredLayer} />
            <Layer {...activeRingLayer} />
          </Source>

          {popup && (
            <Popup
              longitude={popup.longitude}
              latitude={popup.latitude}
              anchor="bottom"
              onClose={() => setPopup(null)}
              closeButton
              maxWidth="300px"
              className="rounded-xl shadow-xl"
            >
              <div className="p-1">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: EVENT_TYPE_COLORS[popup.properties.eventType] ?? '#6b7280',
                    }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {EVENT_TYPE_LABELS[popup.properties.eventType] ?? popup.properties.eventType}
                    {popup.properties.eventSubtype && (
                      <span className="normal-case font-normal">
                        {' '}
                        ·{' '}
                        {EVENT_SUBTYPE_LABELS[popup.properties.eventSubtype] ??
                          popup.properties.eventSubtype}
                      </span>
                    )}
                  </span>
                  <span
                    className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor:
                        popup.properties.severity === 'critical'
                          ? '#fee2e2'
                          : popup.properties.severity === 'high'
                            ? '#ffedd5'
                            : popup.properties.severity === 'moderate'
                              ? '#fef9c3'
                              : '#f0fdf4',
                      color:
                        popup.properties.severity === 'critical'
                          ? '#dc2626'
                          : popup.properties.severity === 'high'
                            ? '#ea580c'
                            : popup.properties.severity === 'moderate'
                              ? '#ca8a04'
                              : '#15803d',
                    }}
                  >
                    {SEVERITY_LABELS[popup.properties.severity] ?? popup.properties.severity}
                  </span>
                </div>

                <h3 className="mb-1 text-sm font-semibold leading-snug text-slate-900">
                  {popup.properties.title}
                </h3>

                <p className="mb-2 text-xs text-slate-500">
                  {popup.properties.locationName ?? popup.properties.district ?? 'Gilgit-Baltistan'}
                  {' · '}
                  {format(new Date(popup.properties.reportedAt), 'MMM d, yyyy')}
                </p>

                {popup.properties.affectedCount != null && (
                  <p className="mb-1.5 text-xs text-slate-600">
                    {popup.properties.affectedCount.toLocaleString()} affected
                  </p>
                )}

                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      color: INCIDENT_STATE_COLORS[popup.properties.state] ?? '#6b7280',
                      backgroundColor: popup.properties.state === 'active' ? '#fee2e2' : '#f1f5f9',
                    }}
                  >
                    {popup.properties.state === 'active' ? 'Active' : 'Resolved'}
                  </span>
                  {popup.properties.locationPrecision &&
                    popup.properties.locationPrecision !== 'pending' && (
                      <span className="text-[10px] text-slate-400">
                        {LOCATION_PRECISION_LABELS[popup.properties.locationPrecision] ??
                          popup.properties.locationPrecision}
                      </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/events/${popup.properties.id}`}
                    className="inline-block rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                  >
                    View details →
                  </a>
                  {popup.properties.evidenceAvailable && (
                    <span className="text-[10px] text-teal-700">Source available</span>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* Legend */}
        <div className="absolute bottom-8 right-3 rounded-xl bg-white/95 px-3 py-2.5 shadow-md ring-1 ring-slate-200 space-y-2.5">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Event type
            </p>
            <div className="space-y-1">
              {ALL_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: EVENT_TYPE_COLORS[t] }}
                  />
                  <span className="text-[11px] text-slate-700">{EVENT_TYPE_LABELS[t]}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Location precision
            </p>
            <div className="space-y-1">
              {[
                { key: 'exact', blur: '0', label: 'Exact' },
                { key: 'approximate', blur: '2px', label: 'Approximate' },
                { key: 'district', blur: '4px', label: 'District-level' },
              ].map(({ key, blur, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-400"
                    style={{ filter: `blur(${blur})` }}
                  />
                  <span className="text-[11px] text-slate-700">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-red-600 bg-transparent" />
                <span className="text-[11px] text-slate-700">Active event</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4h18M7 12h10M11 20h2"
      />
    </svg>
  );
}
