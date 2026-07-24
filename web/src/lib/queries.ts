import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from './db';
import { alerts, events, sources } from './schema';
import type { EventSeverity, EventState, EventStatus, EventSubtype, EventType } from './schema';

export type EventRow = {
  id: number;
  title: string;
  description: string | null;
  eventType: EventType;
  eventSubtype: EventSubtype | null;
  severity: EventSeverity;
  status: EventStatus;
  state: EventState;
  district: string | null;
  locationName: string | null;
  locationPrecision: string | null;
  locationRationale: string | null;
  sourceId: number | null;
  sourceUrl: string | null;
  sourcePostId: string | null;
  embedHtml: string | null;
  affectedCount: number | null;
  reportedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  longitude: number | null;
  latitude: number | null;
};

export type EventDetailRow = EventRow & {
  sourceName: string | null;
  sourceSlug: string | null;
};

const eventSelect = {
  id: events.id,
  title: events.title,
  description: events.description,
  eventType: events.eventType,
  eventSubtype: events.eventSubtype,
  severity: events.severity,
  status: events.status,
  state: events.state,
  district: events.district,
  locationName: events.locationName,
  locationPrecision: events.locationPrecision,
  locationRationale: events.locationRationale,
  sourceId: events.sourceId,
  sourceUrl: events.sourceUrl,
  sourcePostId: events.sourcePostId,
  embedHtml: events.embedHtml,
  affectedCount: events.affectedCount,
  reportedAt: events.reportedAt,
  verifiedAt: events.verifiedAt,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
  longitude: sql<number | null>`ST_X(${events.location}::geometry)`,
  latitude: sql<number | null>`ST_Y(${events.location}::geometry)`,
} as const;

export interface EventFilters {
  types?: string[];
  districts?: string[];
  from?: Date;
  to?: Date;
  status?: string;
  // public lifecycle filter — 'active' | 'resolved'
  state?: string;
}

export async function getEvents(filters?: EventFilters, limit?: number): Promise<EventRow[]> {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(events.status, filters.status as EventStatus));
  }
  if (filters?.state) {
    conditions.push(eq(events.state, filters.state as EventState));
  }
  if (filters?.types?.length) {
    conditions.push(inArray(events.eventType, filters.types as EventType[]));
  }
  if (filters?.districts?.length) {
    conditions.push(inArray(events.district, filters.districts));
  }
  if (filters?.from) {
    conditions.push(gte(events.reportedAt, filters.from));
  }
  if (filters?.to) {
    conditions.push(lte(events.reportedAt, filters.to));
  }

  const query = db
    .select(eventSelect)
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.reportedAt));

  if (limit !== undefined) {
    return query.limit(limit) as Promise<EventRow[]>;
  }
  return query as Promise<EventRow[]>;
}

export async function getEventById(id: number): Promise<EventDetailRow | null> {
  const [row] = await db
    .select({
      ...eventSelect,
      sourceName: sources.name,
      sourceSlug: sources.slug,
    })
    .from(events)
    .leftJoin(sources, eq(events.sourceId, sources.id))
    .where(eq(events.id, id))
    .limit(1);
  return (row ?? null) as EventDetailRow | null;
}

export async function getActiveAlerts(limit = 10) {
  const now = new Date();
  return db
    .select()
    .from(alerts)
    .where(and(eq(alerts.isActive, true), or(isNull(alerts.expiresAt), gte(alerts.expiresAt, now))))
    .orderBy(desc(alerts.issuedAt))
    .limit(limit);
}

export async function getActiveSources() {
  return db.select().from(sources).where(eq(sources.status, 'active'));
}

// ─── Admin alert queries ───────────────────────────────────────────────────────

export type AdminAlertRow = {
  id: number;
  title: string;
  body: string;
  alertType: string;
  level: string;
  district: string | null;
  sourceUrl: string | null;
  isActive: boolean;
  issuedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  aiConfidence: number | null;
  aiSummary: string | null;
  aiVerified: boolean;
};

export async function getAdminAlerts(
  opts: { limit?: number; onlyPendingReview?: boolean } = {},
): Promise<AdminAlertRow[]> {
  const { limit = 50, onlyPendingReview = false } = opts;

  // Pending review = AI processed, confidence in uncertain zone (50–79), still active
  const pendingFilter = and(
    eq(alerts.aiVerified, true),
    gte(alerts.aiConfidence, 50),
    lte(alerts.aiConfidence, 79),
    eq(alerts.isActive, true),
  );

  return db
    .select({
      id: alerts.id,
      title: alerts.title,
      body: alerts.body,
      alertType: alerts.alertType,
      level: alerts.level,
      district: alerts.district,
      sourceUrl: alerts.sourceUrl,
      isActive: alerts.isActive,
      issuedAt: alerts.issuedAt,
      expiresAt: alerts.expiresAt,
      createdAt: alerts.createdAt,
      aiConfidence: alerts.aiConfidence,
      aiSummary: alerts.aiSummary,
      aiVerified: alerts.aiVerified,
    })
    .from(alerts)
    .where(onlyPendingReview ? pendingFilter : undefined)
    .orderBy(desc(alerts.issuedAt))
    .limit(limit) as Promise<AdminAlertRow[]>;
}

export async function getEventStats() {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) filter (where status = 'verified')::int`,
      last30: sql<number>`count(*) filter (where reported_at >= now() - interval '30 days')::int`,
    })
    .from(events);
  return stats ?? { total: 0, verified: 0, last30: 0 };
}
