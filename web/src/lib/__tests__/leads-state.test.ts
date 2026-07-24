import { describe, it, expect } from 'vitest';
import {
  isValidLeadTransition,
  LEAD_TRANSITIONS,
  LEAD_STATE_LABELS,
  LEAD_STATE_COLORS,
  LEAD_QUEUE_TABS,
} from '../leads-state';
import type { LeadState } from '../schema';

const ALL_STATES: LeadState[] = [
  'submitted',
  'needs_clarification',
  'under_review',
  'published',
  'rejected',
  'archived',
];

describe('LEAD_TRANSITIONS completeness', () => {
  it('covers every LeadState', () => {
    for (const state of ALL_STATES) {
      expect(LEAD_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('contains no unknown target states', () => {
    for (const targets of Object.values(LEAD_TRANSITIONS)) {
      for (const t of targets) {
        expect(ALL_STATES).toContain(t);
      }
    }
  });
});

describe('isValidLeadTransition', () => {
  // Valid transitions
  it('submitted → under_review', () =>
    expect(isValidLeadTransition('submitted', 'under_review')).toBe(true));
  it('submitted → rejected', () =>
    expect(isValidLeadTransition('submitted', 'rejected')).toBe(true));
  it('needs_clarification → under_review', () =>
    expect(isValidLeadTransition('needs_clarification', 'under_review')).toBe(true));
  it('under_review → rejected', () =>
    expect(isValidLeadTransition('under_review', 'rejected')).toBe(true));
  it('under_review → needs_clarification', () =>
    expect(isValidLeadTransition('under_review', 'needs_clarification')).toBe(true));

  // Invalid: terminal states block all PATCH transitions
  it('published → anything is blocked', () => {
    for (const s of ALL_STATES) {
      expect(isValidLeadTransition('published', s)).toBe(false);
    }
  });

  it('rejected → anything is blocked', () => {
    for (const s of ALL_STATES) {
      expect(isValidLeadTransition('rejected', s)).toBe(false);
    }
  });

  it('archived → anything is blocked', () => {
    for (const s of ALL_STATES) {
      expect(isValidLeadTransition('archived', s)).toBe(false);
    }
  });

  // 'published' is not reachable via PATCH — only via the /publish API
  it('submitted → published is not a PATCH transition', () => {
    expect(isValidLeadTransition('submitted', 'published')).toBe(false);
  });

  it('under_review → published is not a PATCH transition', () => {
    expect(isValidLeadTransition('under_review', 'published')).toBe(false);
  });

  // Self-transitions are always invalid
  it('state → same state is always invalid', () => {
    for (const s of ALL_STATES) {
      expect(isValidLeadTransition(s, s)).toBe(false);
    }
  });
});

describe('LEAD_STATE_LABELS', () => {
  it('has a label for every state', () => {
    for (const state of ALL_STATES) {
      expect(typeof LEAD_STATE_LABELS[state]).toBe('string');
      expect(LEAD_STATE_LABELS[state].length).toBeGreaterThan(0);
    }
  });
});

describe('LEAD_STATE_COLORS', () => {
  it('has a Tailwind class for every state', () => {
    for (const state of ALL_STATES) {
      expect(typeof LEAD_STATE_COLORS[state]).toBe('string');
      expect(LEAD_STATE_COLORS[state]).toMatch(/^bg-/);
    }
  });
});

describe('LEAD_QUEUE_TABS', () => {
  it('includes the all tab', () => {
    expect(LEAD_QUEUE_TABS.some((t) => t.state === 'all')).toBe(true);
  });

  it('every non-all tab maps to a valid LeadState', () => {
    for (const tab of LEAD_QUEUE_TABS) {
      if (tab.state !== 'all') {
        expect(ALL_STATES).toContain(tab.state);
      }
    }
  });

  it('has unique states', () => {
    const states = LEAD_QUEUE_TABS.map((t) => t.state);
    expect(new Set(states).size).toBe(states.length);
  });
});
