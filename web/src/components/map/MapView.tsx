'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  GB_CENTER,
  GB_DEFAULT_ZOOM,
  GB_DISTRICTS,
  MAP_STYLE,
  SEVERITY_LABELS,
} from '@/lib/constants';

interface EventProperties {
  id: number;
  title: string;
  eventType: string;
  severity: string;
  district: string | null;
  locationName: string | null;
  reportedAt: string;
  sourceUrl: string | null;
  affectedCount: number | null;
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

const unclusteredLayer: LayerProps = {
  id: 'events-unclustered',
  type: 'circle',
  source: 'events',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': TYPE_COLOR_EXPR,
    'circle-radius': SEVERITY_RADIUS_EXPR,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9,
  },
};

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [geojson, setGeojson] = useState<FeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  });
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    types: new Set(ALL_TYPES),
    districts: new Set(),
    from: '',
    to: '',
  });

  // Fetch events GeoJSON
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setGeojson(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filters.from, filters.to]);

  // Filter features client-side by type + district
  const filteredGeojson = useMemo<FeatureCollection>(() => {
    const features = geojson.features.filter((f) => {
      const p = f.properties as EventProperties;
      if (!filters.types.has(p.eventType)) return false;
      if (filters.districts.size > 0 && (!p.district || !filters.districts.has(p.district)))
        return false;
      return true;
    });
    return { type: 'FeatureCollection', features };
  }, [geojson, filters.types, filters.districts]);

  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Handle cluster click → zoom in
    const clusterFeatures = map.queryRenderedFeatures(e.point, {
      layers: ['events-clusters'],
    });
    if (clusterFeatures.length > 0) {
      const f = clusterFeatures[0];
      const coords = (f.geometry as Point).coordinates;
      const zoom = map.getZoom();
      map.easeTo({ center: [coords[0], coords[1]], zoom: zoom + 2, duration: 400 });
      return;
    }

    // Handle single event click → popup
    const eventFeatures = map.queryRenderedFeatures(e.point, {
      layers: ['events-unclustered'],
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

  return (
    <div className="relative flex h-full w-full">
      {/* Filter toggle — mobile */}
      <button
        className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-md ring-1 ring-slate-200 hover:bg-slate-50 md:hidden"
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <FilterIcon />
        Filters
        {filters.districts.size + (filters.types.size < ALL_TYPES.length ? 1 : 0) > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-700 text-[10px] text-white">
            •
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
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-teal-700 hover:underline"
              onClick={() =>
                setFilters({ types: new Set(ALL_TYPES), districts: new Set(), from: '', to: '' })
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

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
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
        </div>

        {/* Event count */}
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          {loading ? 'Loading…' : `${filteredGeojson.features.length} event(s) shown`}
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
          </button>
        )}

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <span className="text-sm text-slate-500">Loading events…</span>
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
          interactiveLayerIds={['events-clusters', 'events-unclustered']}
        >
          <NavigationControl position="top-right" />

          <Source
            id="events"
            type="geojson"
            data={filteredGeojson}
            cluster={true}
            clusterMaxZoom={13}
            clusterRadius={50}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredLayer} />
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
                  <p className="mb-2 text-xs text-slate-600">
                    {popup.properties.affectedCount.toLocaleString()} affected
                  </p>
                )}

                <a
                  href={`/events/${popup.properties.id}`}
                  className="inline-block rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
                >
                  View details →
                </a>
              </div>
            </Popup>
          )}
        </Map>

        {/* Legend */}
        <div className="absolute bottom-8 right-3 rounded-xl bg-white/95 px-3 py-2.5 shadow-md ring-1 ring-slate-200">
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
