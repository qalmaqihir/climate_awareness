import { describe, it, expect } from 'vitest';
import { submitSchema } from '@/lib/leads-submission-schema';

const VALID_MINIMAL = {
  title: 'Flash flood in Hunza valley',
  description: 'A flash flood struck the Hunza valley after heavy rainfall, damaging bridges.',
  contactPermission: false,
};

const VALID_FULL = {
  ...VALID_MINIMAL,
  eventType: 'flood' as const,
  locationDescription: 'Near Karimabad bridge, Hunza',
  district: 'Hunza',
  latitude: 36.3167,
  longitude: 74.65,
  occurredAt: '2024-07-15',
  sourceUrl: 'https://example.com/article',
  sourceDescription: 'Local news report',
  contactPermission: true,
  contactInfo: '+92-300-0000000',
};

describe('submitSchema — valid inputs', () => {
  it('accepts minimal required fields', () => {
    const result = submitSchema.safeParse(VALID_MINIMAL);
    expect(result.success).toBe(true);
  });

  it('accepts full valid payload', () => {
    const result = submitSchema.safeParse(VALID_FULL);
    expect(result.success).toBe(true);
  });

  it('coerces empty sourceUrl to undefined', () => {
    const result = submitSchema.safeParse({ ...VALID_MINIMAL, sourceUrl: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sourceUrl).toBeUndefined();
  });

  it('coerces empty occurredAt to undefined', () => {
    const result = submitSchema.safeParse({ ...VALID_MINIMAL, occurredAt: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.occurredAt).toBeUndefined();
  });

  it('defaults contactPermission to false when omitted', () => {
    const { contactPermission: _, ...withoutPerm } = VALID_MINIMAL;
    void _;
    const result = submitSchema.safeParse(withoutPerm);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contactPermission).toBe(false);
  });

  it('accepts all valid event types', () => {
    const types = [
      'glof',
      'flood',
      'landslide',
      'infrastructure_damage',
      'casualty',
      'displacement',
      'other',
    ];
    for (const t of types) {
      const r = submitSchema.safeParse({ ...VALID_MINIMAL, eventType: t });
      expect(r.success, `eventType=${t} should be valid`).toBe(true);
    }
  });
});

describe('submitSchema — title validation', () => {
  it('rejects empty title', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, title: '' }).success).toBe(false);
  });

  it('rejects title shorter than 5 chars', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, title: 'Hi' }).success).toBe(false);
  });

  it('rejects title longer than 300 chars', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, title: 'a'.repeat(301) }).success).toBe(
      false,
    );
  });
});

describe('submitSchema — description validation', () => {
  it('rejects description shorter than 10 chars', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, description: 'Too short' }).success).toBe(
      false,
    );
  });

  it('rejects description longer than 4000 chars', () => {
    expect(
      submitSchema.safeParse({ ...VALID_MINIMAL, description: 'x'.repeat(4001) }).success,
    ).toBe(false);
  });
});

describe('submitSchema — optional fields', () => {
  it('rejects unknown event type', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, eventType: 'earthquake' }).success).toBe(
      false,
    );
  });

  it('rejects malformed URL as sourceUrl', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, sourceUrl: 'not-a-url' }).success).toBe(
      false,
    );
  });

  it('rejects latitude out of range', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, latitude: 91 }).success).toBe(false);
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, latitude: -91 }).success).toBe(false);
  });

  it('rejects longitude out of range', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, longitude: 181 }).success).toBe(false);
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, longitude: -181 }).success).toBe(false);
  });

  it('rejects malformed occurredAt date', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, occurredAt: '2024/07/15' }).success).toBe(
      false,
    );
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, occurredAt: '15-07-2024' }).success).toBe(
      false,
    );
  });

  it('rejects sourceDescription over 500 chars', () => {
    expect(
      submitSchema.safeParse({ ...VALID_MINIMAL, sourceDescription: 'x'.repeat(501) }).success,
    ).toBe(false);
  });

  it('rejects contactInfo over 500 chars', () => {
    expect(submitSchema.safeParse({ ...VALID_MINIMAL, contactInfo: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });
});
