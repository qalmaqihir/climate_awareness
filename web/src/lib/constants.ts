export const GB_DISTRICTS = [
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

// Gilgit-Baltistan geographic center
export const GB_CENTER = { lng: 74.3436, lat: 35.892 };
export const GB_DEFAULT_ZOOM = 7;

// OpenFreeMap positron — no token required, MapLibre-compatible
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
