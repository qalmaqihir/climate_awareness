import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from './db';
import { alerts, events, sources } from './schema';
import type { EventSeverity, EventStatus, EventType } from './schema';

export type EventRow = {
  id: number;
  title: string;
  description: string | null;
  eventType: EventType;
  severity: EventSeverity;
  status: EventStatus;
  district: string | null;
  locationName: string | null;
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

const eventSelect = {
  id: events.id,
  title: events.title,
  description: events.description,
  eventType: events.eventType,
  severity: events.severity,
  status: events.status,
  district: events.district,
  locationName: events.locationName,
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
}

export async function getEvents(filters?: EventFilters, limit?: number): Promise<EventRow[]> {
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(events.status, filters.status as EventStatus));
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

export async function getEventById(id: number): Promise<EventRow | null> {
  const [row] = await (db
    .select(eventSelect)
    .from(events)
    .where(eq(events.id, id))
    .limit(1) as Promise<EventRow[]>);
  return row ?? null;
}

export async function getActiveAlerts(limit = 10) {
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.isActive, true))
    .orderBy(desc(alerts.issuedAt))
    .limit(limit);
}

export async function getActiveSources() {
  return db.select().from(sources).where(eq(sources.status, 'active'));
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
