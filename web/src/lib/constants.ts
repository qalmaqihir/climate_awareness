// ─── coverage envelope (WGS84) — coordinates outside this box are rejected ────
export const COVERAGE_ENVELOPE = {
  minLat: 34.5,
  maxLat: 37.5,
  minLng: 70.5,
  maxLng: 77.5,
} as const;

export function isWithinCoverage(lat: number, lng: number): boolean {
  return (
    lat >= COVERAGE_ENVELOPE.minLat &&
    lat <= COVERAGE_ENVELOPE.maxLat &&
    lng >= COVERAGE_ENVELOPE.minLng &&
    lng <= COVERAGE_ENVELOPE.maxLng
  );
}

export const GB_DISTRICTS = [
  // Gilgit-Baltistan
  'Gilgit',
  'Hunza',
  'Nagar',
  'Ghizer',
  'Astore',
  'Diamer',
  'Shigar',
  'Skardu',
  'Ghanche',
  'Kharmang',
  // Chitral (KPK)
  'Upper Chitral',
  'Lower Chitral',
] as const;

export type GBDistrict = (typeof GB_DISTRICTS)[number];

export const EVENT_TYPE_COLORS: Record<string, string> = {
  glof: '#ef4444',
  flood: '#3b82f6',
  landslide: '#d97706',
  infrastructure_damage: '#8b5cf6',
  casualty: '#dc2626',
  displacement: '#f97316',
  other: '#6b7280',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  glof: 'GLOF',
  flood: 'Flood',
  landslide: 'Landslide',
  infrastructure_damage: 'Infra Damage',
  casualty: 'Casualty',
  displacement: 'Displacement',
  other: 'Other',
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  critical: '#dc2626',
};

// Geographic center covering GB + Chitral (expanded from GB-only)
export const GB_CENTER = { lng: 73.5, lat: 35.9 };
export const GB_DEFAULT_ZOOM = 6.5;

// ─── incident state labels ────────────────────────────────────────────────────
// state = public lifecycle (active/resolved); status = editorial verification
export const INCIDENT_STATE_LABELS: Record<string, string> = {
  active: 'Active',
  resolved: 'Resolved',
};

export const INCIDENT_STATE_COLORS: Record<string, string> = {
  active: '#dc2626', // red — acute impact ongoing
  resolved: '#6b7280', // grey — historical record
};

// ─── location precision labels ────────────────────────────────────────────────
export const LOCATION_PRECISION_LABELS: Record<string, string> = {
  exact: 'Exact location',
  approximate: 'Approximate location',
  district: 'District-level',
  pending: 'Location pending',
};

// ─── event subtype labels ─────────────────────────────────────────────────────
export const EVENT_SUBTYPE_LABELS: Record<string, string> = {
  flash_flood: 'Flash flood',
};

// ─── canonical type set used by seed, API, and map ───────────────────────────
// flash_flood is NOT a canonical EventType; it is an eventSubtype under flood.
export const CANONICAL_EVENT_TYPES = [
  'glof',
  'flood',
  'landslide',
  'infrastructure_damage',
  'casualty',
  'displacement',
  'other',
] as const;

// OpenFreeMap positron — no token required, MapLibre-compatible
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
