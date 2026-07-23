import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AdapterAccountType } from 'next-auth/adapters';

// PostGIS geography(Point, 4326) — stored as WKT, queried via ST_* functions
const geography = customType<{ data: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  },
  toDriver(value: string) {
    return sql`ST_GeogFromText(${value})`;
  },
  fromDriver(value: unknown) {
    return value as string;
  },
});

// ─── sources ──────────────────────────────────────────────────────────────────
export type SourceType = 'media' | 'government' | 'ngo' | 'academic' | 'community';
export type SourceStatus = 'active' | 'inactive' | 'pending';

export const sources = pgTable('sources', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  url: text('url').notNull(),
  type: text('type').$type<SourceType>().notNull(),
  status: text('status').$type<SourceStatus>().notNull().default('active'),
  description: text('description'),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── events ───────────────────────────────────────────────────────────────────
export type EventType =
  'glof' | 'flood' | 'landslide' | 'infrastructure_damage' | 'casualty' | 'displacement' | 'other';
export type EventSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type EventStatus = 'verified' | 'unverified' | 'disputed' | 'archived';

export const events = pgTable(
  'events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    eventType: text('event_type').$type<EventType>().notNull(),
    severity: text('severity').$type<EventSeverity>().notNull().default('moderate'),
    status: text('status').$type<EventStatus>().notNull().default('unverified'),
    location: geography('location'),
    locationName: text('location_name'),
    district: text('district'),
    sourceId: integer('source_id').references(() => sources.id, {
      onDelete: 'set null',
    }),
    sourceUrl: text('source_url'),
    sourcePostId: text('source_post_id'),
    embedHtml: text('embed_html'),
    affectedCount: integer('affected_count'),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('events_event_type_idx').on(t.eventType),
    index('events_reported_at_idx').on(t.reportedAt),
    index('events_district_idx').on(t.district),
    index('events_status_idx').on(t.status),
  ],
);

// ─── alerts ───────────────────────────────────────────────────────────────────
export type AlertType = 'glof' | 'flood' | 'weather' | 'landslide' | 'general';
export type AlertLevel = 'advisory' | 'watch' | 'warning' | 'emergency';

export const alerts = pgTable(
  'alerts',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    alertType: text('alert_type').$type<AlertType>().notNull(),
    level: text('level').$type<AlertLevel>().notNull(),
    district: text('district'),
    sourceId: integer('source_id').references(() => sources.id, {
      onDelete: 'set null',
    }),
    sourceUrl: text('source_url'),
    isActive: boolean('is_active').notNull().default(true),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('alerts_is_active_idx').on(t.isActive),
    index('alerts_issued_at_idx').on(t.issuedAt),
  ],
);

// ─── weather_snapshots ────────────────────────────────────────────────────────
// Cached Open-Meteo responses, refreshed by worker on schedule
export const weatherSnapshots = pgTable('weather_snapshots', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  district: text('district').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  temperatureCelsius: real('temperature_celsius'),
  precipitationMm: real('precipitation_mm'),
  windspeedKmh: real('windspeed_kmh'),
  weatherCode: integer('weather_code'),
  rawJson: text('raw_json'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── NextAuth tables (required by @auth/drizzle-adapter) ──────────────────────
export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  // Extra field for credentials auth — bcrypt hash stored here
  passwordHash: text('password_hash'),
  isAdmin: boolean('is_admin').notNull().default(false),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
