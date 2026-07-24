import { z } from 'zod/v4';
import { COVERAGE_ENVELOPE } from './constants';

export const EVENT_TYPES = [
  'glof',
  'flood',
  'landslide',
  'infrastructure_damage',
  'casualty',
  'displacement',
  'other',
] as const;

const urlOrEmpty = z
  .string()
  .max(1000)
  .refine((v) => v === '' || z.url().safeParse(v).success, { message: 'Must be a valid URL' })
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const submitSchema = z
  .object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(300),
    description: z.string().min(10, 'Description must be at least 10 characters').max(4000),
    eventType: z.enum(EVENT_TYPES).optional(),
    locationDescription: z.string().max(500).optional(),
    district: z.string().max(100).optional(),
    // GB coverage bounds — same envelope enforced on the publish form
    latitude: z
      .number()
      .min(COVERAGE_ENVELOPE.minLat, 'Latitude outside GB coverage area')
      .max(COVERAGE_ENVELOPE.maxLat, 'Latitude outside GB coverage area')
      .optional(),
    longitude: z
      .number()
      .min(COVERAGE_ENVELOPE.minLng, 'Longitude outside GB coverage area')
      .max(COVERAGE_ENVELOPE.maxLng, 'Longitude outside GB coverage area')
      .optional(),
    occurredAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .optional()
      .or(z.literal(''))
      .transform((v) => (v === '' ? undefined : v)),
    sourceUrl: urlOrEmpty,
    sourceDescription: z.string().max(500).optional(),
    contactPermission: z.boolean().default(false),
    contactInfo: z.string().max(500).optional(),
  })
  .refine((d) => (d.latitude == null) === (d.longitude == null), {
    message: 'Provide both latitude and longitude, or neither',
    path: ['latitude'],
  });

export type SubmitInput = z.input<typeof submitSchema>;
