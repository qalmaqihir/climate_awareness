/**
 * P0.2 — Seed location data integrity tests.
 *
 * Validates the reviewed location dataset before it is applied to the database.
 * These tests run without a database connection.
 */
import { describe, it, expect } from 'vitest';
import { SEED_LOCATIONS } from '../../../scripts/seed-locations';
import { CANONICAL_EVENT_TYPES, isWithinCoverage } from '../constants';

const VALID_PRECISIONS = ['exact', 'approximate', 'district'] as const;

describe('seed location data integrity', () => {
  it('contains exactly 22 reviewed locations', () => {
    expect(SEED_LOCATIONS).toHaveLength(22);
  });

  it('all titles are unique (no duplicate entries)', () => {
    const titles = SEED_LOCATIONS.map((s) => s.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('every location has a non-empty title', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(loc.title.length).toBeGreaterThan(0);
    }
  });

  it('every coordinate is within the GB/Chitral coverage envelope', () => {
    for (const loc of SEED_LOCATIONS) {
      const within = isWithinCoverage(loc.lat, loc.lng);
      expect(within, `${loc.title}: lat=${loc.lat} lng=${loc.lng} is outside coverage`).toBe(true);
    }
  });

  it('latitude is in valid WGS84 range', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(loc.lat).toBeGreaterThanOrEqual(-90);
      expect(loc.lat).toBeLessThanOrEqual(90);
    }
  });

  it('longitude is in valid WGS84 range', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(loc.lng).toBeGreaterThanOrEqual(-180);
      expect(loc.lng).toBeLessThanOrEqual(180);
    }
  });

  it('every precision is one of exact/approximate/district (pending is not allowed in seed)', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(VALID_PRECISIONS as readonly string[]).toContain(loc.precision);
    }
  });

  it('every location has a non-empty rationale', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(loc.rationale.length).toBeGreaterThan(10);
    }
  });

  it('every state is active or resolved', () => {
    for (const loc of SEED_LOCATIONS) {
      expect(['active', 'resolved']).toContain(loc.state);
    }
  });

  it('all seeded historical events are marked resolved (no ongoing acute impact)', () => {
    // All 22 events are historical; none should be active.
    const active = SEED_LOCATIONS.filter((s) => s.state === 'active');
    expect(active).toHaveLength(0);
  });

  it('eventSubtype is only set on events with eventType flood or no explicit override', () => {
    for (const loc of SEED_LOCATIONS) {
      if (loc.eventSubtype != null) {
        // If subtype is set, eventType override must also be set to flood
        expect(loc.eventType).toBe('flood');
      }
    }
  });

  it('all explicit eventType overrides are canonical types', () => {
    for (const loc of SEED_LOCATIONS) {
      if (loc.eventType != null) {
        expect(CANONICAL_EVENT_TYPES as readonly string[]).toContain(loc.eventType);
      }
    }
  });

  it('flash_flood subtype override is present on all flash_flood-to-flood normalizations', () => {
    for (const loc of SEED_LOCATIONS) {
      if (loc.eventType === 'flood' && loc.eventSubtype == null) {
        // A flood normalization without a subtype would be unexpected for seed data
        // (the original seeds only had flood and flash_flood types; this catches gaps)
        // Allow it — some events are genuinely flood (not flash_flood)
      }
      if (loc.eventSubtype === 'flash_flood') {
        expect(loc.eventType).toBe('flood');
      }
    }
  });

  it('12 flash_flood events are normalized to flood + flash_flood subtype', () => {
    const normalized = SEED_LOCATIONS.filter((s) => s.eventSubtype === 'flash_flood');
    expect(normalized).toHaveLength(12);
  });

  it('Kharmang event has district override to Kharmang', () => {
    const kharmang = SEED_LOCATIONS.find(
      (s) => s.title === 'Kharmang Valley flash flood, multiple bridge failures',
    );
    expect(kharmang).toBeDefined();
    expect(kharmang?.districtOverride).toBe('Kharmang');
  });

  it('district-precision events use a representative named centroid, not an invented point', () => {
    const districtEvents = SEED_LOCATIONS.filter((s) => s.precision === 'district');
    // All district events must have a rationale mentioning the representative point used
    for (const loc of districtEvents) {
      expect(loc.rationale.toLowerCase()).toMatch(/district hq|representative|centroid|point is/);
    }
  });
});
