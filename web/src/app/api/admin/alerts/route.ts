/**
 * GET /api/admin/alerts
 *
 * Returns paginated alerts with AI fields for the admin panel.
 *
 * Query params:
 *   pendingReview=1  — only alerts in the 50-79 AI confidence range (needs human review)
 *   active=1         — only is_active=true alerts
 *   suppressed=1     — only is_active=false alerts
 *   limit=N          — default 50, max 200
 */
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { alerts } from '@/lib/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const pendingReview = searchParams.get('pendingReview') === '1';
  const activeOnly = searchParams.get('active') === '1';
  const suppressedOnly = searchParams.get('suppressed') === '1';

  const conditions = [];

  if (pendingReview) {
    conditions.push(
      eq(alerts.aiVerified, true),
      gte(alerts.aiConfidence, 50),
      lte(alerts.aiConfidence, 79),
      eq(alerts.isActive, true),
    );
  } else if (activeOnly) {
    conditions.push(eq(alerts.isActive, true));
  } else if (suppressedOnly) {
    conditions.push(eq(alerts.isActive, false));
  }

  const rows = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alerts.issuedAt))
    .limit(limit);

  return NextResponse.json({ alerts: rows, count: rows.length });
}
