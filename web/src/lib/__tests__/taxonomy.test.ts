/**
 * P0.1 — Taxonomy contract tests.
 *
 * These tests enforce the canonical event-type taxonomy, precision levels, and
 * coverage envelope. They must pass before any map rendering changes are made.
 */
import { describe, it, expect } from 'vitest';
import {
  CANONICAL_EVENT_TYPES,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_SUBTYPE_LABELS,
  LOCATION_PRECISION_LABELS,
  INCIDENT_STATE_LABELS,
  COVERAGE_ENVELOPE,
  isWithinCoverage,
} from '../constants';

// ─── canonical event types ────────────────────────────────────────────────────

describe('canonical event types', () => {
  it('flash_flood is NOT a canonical EventType', () => {
    expect(CANONICAL_EVENT_TYPES).not.toContain('flash_flood');
  });

  it('flash_flood IS a recognised event subtype', () => {
    expect(EVENT_SUBTYPE_LABELS).toHaveProperty('flash_flood');
  });

  it('every canonical type has a colour', () => {
    for (const t of CANONICAL_EVENT_TYPES) {
      expect(EVENT_TYPE_COLORS).toHaveProperty(t);
      // colour must be a valid hex string
      expect(EVENT_TYPE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('every canonical type has a human label', () => {
    for (const t of CANONICAL_EVENT_TYPES) {
      expect(EVENT_TYPE_LABELS).toHaveProperty(t);
      expect(typeof EVENT_TYPE_LABELS[t]).toBe('string');
      expect(EVENT_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it('no extra types appear in EVENT_TYPE_COLORS beyond canonical set', () => {
    const colourKeys = Object.keys(EVENT_TYPE_COLORS);
    for (const k of colourKeys) {
      expect(CANONICAL_EVENT_TYPES).toContain(k);
    }
  });

  it('no extra types appear in EVENT_TYPE_LABELS beyond canonical set', () => {
    const labelKeys = Object.keys(EVENT_TYPE_LABELS);
    for (const k of labelKeys) {
      expect(CANONICAL_EVENT_TYPES).toContain(k);
    }
  });
});

// ─── location precision ───────────────────────────────────────────────────────

describe('location precision', () => {
  const VALID_PRECISIONS = ['exact', 'approximate', 'district', 'pending'] as const;

  it('all four precision levels have labels', () => {
    for (const p of VALID_PRECISIONS) {
      expect(LOCATION_PRECISION_LABELS).toHaveProperty(p);
      expect(LOCATION_PRECISION_LABELS[p].length).toBeGreaterThan(0);
    }
  });

  it('exact requires coordinates (documented constraint)', () => {
    // This test documents the rule: exact without coordinates is invalid.
    // The actual enforcement is in the API validation layer (P0.3).
    // Here we confirm that 'exact' is a recognised precision value.
    expect(VALID_PRECISIONS).toContain('exact');
  });

  it('pending must not produce a map point (documented constraint)', () => {
    // pending is the only precision that must never yield a GeoJSON feature.
    // Enforcement is in the API; this test documents the contract.
    expect(VALID_PRECISIONS).toContain('pending');
    // pending must appear last or separate to highlight its special status.
    expect(LOCATION_PRECISION_LABELS['pending']).toBeTruthy();
  });
});

// ─── incident state ───────────────────────────────────────────────────────────

describe('incident state', () => {
  it('active and resolved are the only valid states', () => {
    expect(Object.keys(INCIDENT_STATE_LABELS)).toEqual(['active', 'resolved']);
  });

  it('archived is NOT a synonym for resolved (separate concerns)', () => {
    // state = public lifecycle; status = editorial verification
    expect(Object.keys(INCIDENT_STATE_LABELS)).not.toContain('archived');
  });
});

// ─── coverage envelope ────────────────────────────────────────────────────────

describe('coverage envelope', () => {
  it('Gilgit city is within coverage', () => {
    expect(isWithinCoverage(35.92, 74.31)).toBe(true);
  });

  it('Skardu is within coverage', () => {
    expect(isWithinCoverage(35.3, 75.63)).toBe(true);
  });

  it('Chitral is within coverage', () => {
    expect(isWithinCoverage(35.85, 71.78)).toBe(true);
  });

  it('Karachi is outside coverage', () => {
    expect(isWithinCoverage(24.86, 67.01)).toBe(false);
  });

  it('Kabul is outside coverage', () => {
    expect(isWithinCoverage(34.52, 69.18)).toBe(false);
  });

  it('coordinate at exact boundary is within coverage', () => {
    expect(isWithinCoverage(COVERAGE_ENVELOPE.minLat, COVERAGE_ENVELOPE.minLng)).toBe(true);
    expect(isWithinCoverage(COVERAGE_ENVELOPE.maxLat, COVERAGE_ENVELOPE.maxLng)).toBe(true);
  });

  it('coordinate just outside boundary is rejected', () => {
    expect(isWithinCoverage(COVERAGE_ENVELOPE.minLat - 0.001, COVERAGE_ENVELOPE.minLng)).toBe(
      false,
    );
    expect(isWithinCoverage(COVERAGE_ENVELOPE.maxLat + 0.001, COVERAGE_ENVELOPE.maxLng)).toBe(
      false,
    );
  });
});
