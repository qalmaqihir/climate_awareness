import { z } from 'zod/v4';

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

export const submitSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(300),
  description: z.string().min(10, 'Description must be at least 10 characters').max(4000),
  eventType: z.enum(EVENT_TYPES).optional(),
  locationDescription: z.string().max(500).optional(),
  district: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
});

export type SubmitInput = z.input<typeof submitSchema>;
