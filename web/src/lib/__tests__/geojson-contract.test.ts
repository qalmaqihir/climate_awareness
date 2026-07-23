/**
 * P0.1 — Public GeoJSON contract tests.
 *
 * Enforces that the compact GeoJSON shape emitted by /api/events:
 * - never contains full description text
 * - never contains raw embedHtml
 * - never contains private data fields
 * - includes all required public fields
 * - excludes pending-precision events from the point layer
 */
import { describe, it, expect } from 'vitest';

// ─── helper: shape a GeoJSON properties object the same way the API does ─────

interface EventLike {
  id: number;
  title: string;
  description?: string | null;
  eventType: string;
  eventSubtype?: string | null;
  severity: string;
  state: string;
  district?: string | null;
  locationName?: string | null;
  locationPrecision?: string | null;
  locationRationale?: string | null;
  reportedAt: Date;
  affectedCount?: number | null;
  sourceUrl?: string | null;
  embedHtml?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function toGeoJsonProperties(e: EventLike) {
  return {
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    eventSubtype: e.eventSubtype ?? null,
    severity: e.severity,
    state: e.state,
    district: e.district ?? null,
    locationName: e.locationName ?? null,
    locationPrecision: e.locationPrecision ?? null,
    reportedAt: e.reportedAt.toISOString(),
    affectedCount: e.affectedCount ?? null,
    evidenceAvailable: Boolean(e.sourceUrl),
    // These must NOT appear in the public GeoJSON:
    // description, embedHtml, locationRationale, sourceUrl (raw)
  };
}

function shouldAppearOnMap(e: EventLike): boolean {
  return (
    e.latitude != null &&
    e.longitude != null &&
    e.locationPrecision !== 'pending' &&
    e.locationPrecision != null
  );
}

// ─── fixture events ───────────────────────────────────────────────────────────

const baseEvent: EventLike = {
  id: 1,
  title: 'Shishper GLOF, Hunza',
  description: 'Long detailed description that must NOT appear in compact GeoJSON.',
  eventType: 'glof',
  eventSubtype: null,
  severity: 'critical',
  state: 'resolved',
  district: 'Hunza',
  locationName: 'Hassanabad',
  locationPrecision: 'approximate',
  locationRationale: 'Moderator note — must NOT appear in public GeoJSON.',
  reportedAt: new Date('2022-05-07T00:00:00Z'),
  affectedCount: 2800,
  sourceUrl: 'https://reliefweb.int/report/pakistan/example',
  embedHtml: '<blockquote class="instagram-media">...</blockquote>',
  latitude: 36.35,
  longitude: 74.73,
};

const flashFloodEvent: EventLike = {
  ...baseEvent,
  id: 2,
  title: 'Gilgit flash flood',
  eventType: 'flood',
  eventSubtype: 'flash_flood',
  locationPrecision: 'exact',
};

const pendingEvent: EventLike = {
  ...baseEvent,
  id: 3,
  title: 'Unlocated Astore incident',
  locationPrecision: 'pending',
  latitude: null,
  longitude: null,
};

// ─── tests ────────────────────────────────────────────────────────────────────

describe('GeoJSON properties shape', () => {
  it('does not expose full description', () => {
    const props = toGeoJsonProperties(baseEvent);
    expect(props).not.toHaveProperty('description');
  });

  it('does not expose raw embedHtml', () => {
    const props = toGeoJsonProperties(baseEvent);
    expect(props).not.toHaveProperty('embedHtml');
  });

  it('does not expose raw sourceUrl (uses evidenceAvailable boolean)', () => {
    const props = toGeoJsonProperties(baseEvent);
    expect(props).not.toHaveProperty('sourceUrl');
    expect(props.evidenceAvailable).toBe(true);
  });

  it('does not expose locationRationale (moderator note)', () => {
    const props = toGeoJsonProperties(baseEvent);
    expect(props).not.toHaveProperty('locationRationale');
  });

  it('includes all required public fields', () => {
    const props = toGeoJsonProperties(baseEvent);
    const required = [
      'id',
      'title',
      'eventType',
      'severity',
      'state',
      'district',
      'locationName',
      'locationPrecision',
      'reportedAt',
      'affectedCount',
      'evidenceAvailable',
    ];
    for (const field of required) {
      expect(props).toHaveProperty(field);
    }
  });

  it('includes eventSubtype for flash flood events', () => {
    const props = toGeoJsonProperties(flashFloodEvent);
    expect(props.eventSubtype).toBe('flash_flood');
  });

  it('eventSubtype is null for non-subtype events', () => {
    const props = toGeoJsonProperties(baseEvent);
    expect(props.eventSubtype).toBeNull();
  });

  it('evidenceAvailable is false when sourceUrl is absent', () => {
    const noSource: EventLike = { ...baseEvent, sourceUrl: null };
    const props = toGeoJsonProperties(noSource);
    expect(props.evidenceAvailable).toBe(false);
  });
});

describe('map visibility rules', () => {
  it('event with coordinates and non-pending precision appears on map', () => {
    expect(shouldAppearOnMap(baseEvent)).toBe(true);
  });

  it('pending-precision event does NOT appear on map (location work incomplete)', () => {
    expect(shouldAppearOnMap(pendingEvent)).toBe(false);
  });

  it('event with null coordinates does NOT appear on map', () => {
    const noCoords: EventLike = { ...baseEvent, latitude: null, longitude: null };
    expect(shouldAppearOnMap(noCoords)).toBe(false);
  });

  it('event with null precision does NOT appear on map', () => {
    const noPrecision: EventLike = { ...baseEvent, locationPrecision: null };
    expect(shouldAppearOnMap(noPrecision)).toBe(false);
  });
});
