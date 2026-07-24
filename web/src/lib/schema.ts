import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
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

// pgvector vector type — stored as bracket-format string "[0.1,0.2,...]"
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      if (!value) return [];
      return value.slice(1, -1).split(',').map(Number);
    },
  })(name);

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
// flash_flood is not a canonical EventType; it is an eventSubtype under flood.
export type EventSubtype = 'flash_flood';
export type EventSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type EventStatus = 'verified' | 'unverified' | 'disputed' | 'archived';
// state tracks the public incident lifecycle; status tracks editorial verification.
// archived ≠ resolved: archived is a private editorial state; resolved is a public lifecycle state.
export type EventState = 'active' | 'resolved';
// Honest location model: exact requires a source-supported specific site;
// approximate = named locality but uncertain exact site;
// district = multi-valley or district-wide report; pending = no publishable geometry yet.
export type LocationPrecision = 'exact' | 'approximate' | 'district' | 'pending';

export const events = pgTable(
  'events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description'),
    eventType: text('event_type').$type<EventType>().notNull(),
    // Only set when eventType == 'flood' and the incident is specifically a flash flood.
    eventSubtype: text('event_subtype').$type<EventSubtype>(),
    severity: text('severity').$type<EventSeverity>().notNull().default('moderate'),
    // editorial verification state — not the same as the public incident lifecycle state
    status: text('status').$type<EventStatus>().notNull().default('unverified'),
    // public incident lifecycle: active while acute impact continues; resolved when ended
    state: text('state').$type<EventState>().notNull().default('active'),
    location: geography('location'),
    // honest location model: must be set before any location is made public
    locationPrecision: text('location_precision').$type<LocationPrecision>().default('pending'),
    // source/rationale for the approved public geometry (moderator note)
    locationRationale: text('location_rationale'),
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
    // pgvector embedding for RAG search (Phase 2.A). NULL until worker indexes the event.
    embeddingV1: vector('embedding_v1', 1024),
    // AI verification score and summary — set when admin-submitted events are verified by AI
    aiConfidence: smallint('ai_confidence'),
    aiSummary: text('ai_summary'),
  },
  (t) => [
    index('events_event_type_idx').on(t.eventType),
    index('events_reported_at_idx').on(t.reportedAt),
    index('events_district_idx').on(t.district),
    index('events_status_idx').on(t.status),
    // Composite index for the most common query: verified events ordered by date
    index('events_status_reported_at_idx').on(t.status, t.reportedAt),
    // State is a public filter parameter (active/resolved) — needs its own index
    index('events_state_idx').on(t.state),
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
    sourceUrl: text('source_url').unique('alerts_source_url_unique'),
    isActive: boolean('is_active').notNull().default(true),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // AI verification fields — set by verify-alerts worker job
    aiConfidence: smallint('ai_confidence'),
    aiSummary: text('ai_summary'),
    aiVerified: boolean('ai_verified').notNull().default(false),
  },
  (t) => [
    index('alerts_is_active_idx').on(t.isActive),
    index('alerts_issued_at_idx').on(t.issuedAt),
    // Index for deduplication query in the worker scraper
    index('alerts_source_url_idx').on(t.sourceUrl),
    // Lets the worker pick unprocessed rows cheaply
    index('alerts_ai_verified_idx').on(t.aiVerified),
  ],
);

// ─── weather_snapshots ────────────────────────────────────────────────────────
// Cached Open-Meteo responses, refreshed by worker on schedule
export const weatherSnapshots = pgTable(
  'weather_snapshots',
  {
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
  },
  (t) => [
    // Supports "latest per district" queries and 48h cleanup
    index('weather_snapshots_district_fetched_idx').on(t.district, t.fetchedAt),
  ],
);

// ─── query_logs ───────────────────────────────────────────────────────────────
// RAG agent usage log. No PII — query and IP are SHA-256 hashed before storage.
export const queryLogs = pgTable(
  'query_logs',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    queryHash: text('query_hash').notNull(),
    ipHash: text('ip_hash').notNull(),
    docCount: integer('doc_count'),
    modelUsed: text('model_used'),
    durationMs: integer('duration_ms'),
    blocked: boolean('blocked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Supports the 90-day retention cleanup query
    index('query_logs_created_at_idx').on(t.createdAt),
  ],
);

// ─── NextAuth tables (required by @auth/drizzle-adapter) ──────────────────────
export type UserRole = 'admin' | 'contributor';

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
  // Role gates access: 'admin' = full admin panel; 'contributor' = lead submission only
  role: text('role').$type<UserRole>().notNull().default('admin'),
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

// ─── P1 leads data model ──────────────────────────────────────────────────────
// Private inbound reports from trusted contributors; never exposed publicly.
// State machine: submitted → needs_clarification | under_review → published | rejected | archived

export type LeadState =
  'submitted' | 'needs_clarification' | 'under_review' | 'published' | 'rejected' | 'archived';
export type LeadIntakeChannel = 'web' | 'sms' | 'whatsapp' | 'voice' | 'moderator';
export type EvidenceType = 'url' | 'media' | 'document' | 'social_post';
export type EvidencePrivacyState = 'private' | 'moderator_only' | 'publishable';
export type ReviewerVisibility = 'hidden' | 'internal' | 'public';
export type ReviewDecisionAction =
  | 'publish'
  | 'reject'
  | 'needs_clarification'
  | 'merge'
  | 'relate'
  | 'attach_update'
  | 'refine_location'
  | 'archive';
export type ReviewTargetType = 'lead' | 'event' | 'evidence';
export type IncidentUpdateType = 'status' | 'correction' | 'resolution' | 'severity_change';
export type IncidentRelationType = 'duplicate' | 'related' | 'supersedes';

export const leads = pgTable(
  'leads',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    submitterId: text('submitter_id').references(() => users.id, { onDelete: 'set null' }),
    submitterEmail: text('submitter_email').notNull(),
    intakeChannel: text('intake_channel').$type<LeadIntakeChannel>().notNull().default('web'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    eventType: text('event_type').$type<EventType>(),
    eventSubtype: text('event_subtype').$type<EventSubtype>(),
    locationDescription: text('location_description'),
    district: text('district'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    locationPrecision: text('location_precision').$type<LocationPrecision>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
    contactPermission: boolean('contact_permission').notNull().default(false),
    contactInfo: text('contact_info'),
    state: text('state').$type<LeadState>().notNull().default('submitted'),
    publishedEventId: integer('published_event_id').references(() => events.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('leads_state_idx').on(t.state),
    index('leads_submitter_idx').on(t.submitterId),
    index('leads_event_idx').on(t.publishedEventId),
  ],
);

export const leadEvidence = pgTable(
  'lead_evidence',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    evidenceType: text('evidence_type').$type<EvidenceType>().notNull(),
    sourceUrl: text('source_url'),
    mediaRef: text('media_ref'),
    description: text('description'),
    privacyState: text('privacy_state').$type<EvidencePrivacyState>().notNull().default('private'),
    consentGiven: boolean('consent_given').notNull().default(false),
    reviewerVisibility: text('reviewer_visibility')
      .$type<ReviewerVisibility>()
      .notNull()
      .default('hidden'),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lead_evidence_lead_idx').on(t.leadId)],
);

export const incidentUpdates = pgTable(
  'incident_updates',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    updateText: text('update_text').notNull(),
    updateType: text('update_type').$type<IncidentUpdateType>().notNull().default('status'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('incident_updates_event_idx').on(t.eventId)],
);

export const incidentRelations = pgTable(
  'incident_relations',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    sourceEventId: integer('source_event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    targetEventId: integer('target_event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    relationType: text('relation_type').$type<IncidentRelationType>().notNull(),
    note: text('note'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('incident_relations_pair_unique').on(t.sourceEventId, t.targetEventId)],
);

export const reviewDecisions = pgTable(
  'review_decisions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewerEmail: text('reviewer_email').notNull(),
    targetType: text('target_type').$type<ReviewTargetType>().notNull(),
    targetId: integer('target_id').notNull(),
    action: text('action').$type<ReviewDecisionAction>().notNull(),
    rationale: text('rationale'),
    beforeState: jsonb('before_state').$type<Record<string, unknown>>(),
    afterState: jsonb('after_state').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('review_decisions_target_idx').on(t.targetType, t.targetId),
    index('review_decisions_reviewer_idx').on(t.reviewerId),
  ],
);

// ─── subscribers ──────────────────────────────────────────────────────────────
// Push notification opt-ins. At least one of phone or telegram_chat_id must be
// non-null — enforced by a DB CHECK constraint written in the migration.
export const subscribers = pgTable(
  'subscribers',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // E.164 format: +923001234567. Null when subscriber is Telegram-only.
    phone: text('phone').unique(),
    // Telegram chat ID. Null when subscriber is SMS-only.
    telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).unique(),
    // One or more district names from GB_DISTRICTS; empty = all regions.
    districts: text('districts').array().notNull().default([]),
    // Notification language preference. 'ur' = Urdu (v2 scope).
    language: text('language').notNull().default('en'),
    active: boolean('active').notNull().default(true),
    optInAt: timestamp('opt_in_at', { withTimezone: true }).notNull().defaultNow(),
    optOutAt: timestamp('opt_out_at', { withTimezone: true }),
  },
  (t) => [
    index('subscribers_active_idx').on(t.active),
    // GIN index lets Postgres evaluate `districts && ARRAY['Hunza']` efficiently
    index('subscribers_districts_gin_idx').using('gin', t.districts),
  ],
);

// ─── sms_otps ─────────────────────────────────────────────────────────────────
// Short-lived OTP codes for SMS phone verification. Keyed by phone (E.164).
// Expired rows are cleaned up by the worker cleanup job.
export const smsOtps = pgTable('sms_otps', {
  phone: text('phone').primaryKey(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
