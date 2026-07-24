import { asc, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { leads, leadEvidence, users } from './schema';
import type { LeadState } from './schema';

export const LEADS_PER_PAGE = 50;

export async function getLeads(
  filter: { state?: LeadState } = {},
  limit = LEADS_PER_PAGE,
  offset = 0,
) {
  const where = filter.state !== undefined ? eq(leads.state, filter.state) : undefined;
  return db
    .select({
      id: leads.id,
      title: leads.title,
      submitterEmail: leads.submitterEmail,
      eventType: leads.eventType,
      district: leads.district,
      state: leads.state,
      intakeChannel: leads.intakeChannel,
      contactPermission: leads.contactPermission,
      reportedAt: leads.reportedAt,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset);
}

export type LeadListItem = Awaited<ReturnType<typeof getLeads>>[number];

export async function getLeadById(id: number) {
  const [lead] = await db
    .select({
      id: leads.id,
      submitterId: leads.submitterId,
      submitterEmail: leads.submitterEmail,
      intakeChannel: leads.intakeChannel,
      title: leads.title,
      description: leads.description,
      eventType: leads.eventType,
      eventSubtype: leads.eventSubtype,
      locationDescription: leads.locationDescription,
      district: leads.district,
      latitude: leads.latitude,
      longitude: leads.longitude,
      locationPrecision: leads.locationPrecision,
      occurredAt: leads.occurredAt,
      reportedAt: leads.reportedAt,
      contactPermission: leads.contactPermission,
      contactInfo: leads.contactInfo,
      state: leads.state,
      publishedEventId: leads.publishedEventId,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);

  if (!lead) return null;

  const evidence = await db
    .select()
    .from(leadEvidence)
    .where(eq(leadEvidence.leadId, id))
    .orderBy(asc(leadEvidence.createdAt));

  return { ...lead, evidence };
}

export type LeadDetail = Awaited<ReturnType<typeof getLeadById>>;

// Resolve the DB user id from session email (needed to write review_decisions FK)
export async function getReviewerByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}
