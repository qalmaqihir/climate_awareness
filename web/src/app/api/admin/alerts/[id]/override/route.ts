/**
 * POST /api/admin/alerts/[id]/override
 *
 * Lets an admin override the AI verification decision for an alert.
 * Wraps the alert UPDATE and audit INSERT in a transaction — both succeed or neither does.
 * When action='verify', sets needs_push_notify=true so the worker dispatches
 * push notifications on its next run (avoids cross-package import of push-notify).
 *
 * Body: { action: 'verify' | 'suppress', rationale?: string }
 *   verify   → is_active=true, ai_verified=true, ai_confidence=100, needs_push_notify=true
 *   suppress → is_active=false, ai_verified=true, ai_confidence=0
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const bodySchema = z.object({
  action: z.enum(['verify', 'suppress']),
  rationale: z.string().max(1000).optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // reviewer_id is a NOT NULL FK to users.id — must be a real user ID
  const reviewerId = session.user.id;
  if (!reviewerId) {
    return NextResponse.json({ error: 'Session missing user ID' }, { status: 500 });
  }

  const { id } = await params;
  const alertId = parseInt(id, 10);
  if (isNaN(alertId) || alertId <= 0) {
    return NextResponse.json({ error: 'Invalid alert id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, rationale } = parsed.data;

  // Fetch current state for audit record
  const current = await db
    .execute(
      sql`
    SELECT is_active, ai_confidence, ai_summary FROM alerts WHERE id = ${alertId} LIMIT 1
  `,
    )
    .catch(() => null);

  if (!current || current.rows.length === 0) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  const isActive = action === 'verify';
  const aiConfidence = action === 'verify' ? 100 : 0;
  const aiSummary =
    action === 'verify'
      ? `Human override: verified by admin (${session.user.email ?? 'unknown'})`
      : `Human override: suppressed by admin (${session.user.email ?? 'unknown'})`;
  // When admin verifies, flag for push dispatch on the worker's next cycle
  const needsPushNotify = action === 'verify';

  const beforeState = {
    is_active: current.rows[0].is_active,
    ai_confidence: current.rows[0].ai_confidence,
    ai_summary: current.rows[0].ai_summary,
  };
  const afterState = { is_active: isActive, ai_confidence: aiConfidence, ai_summary: aiSummary };

  // Both UPDATE and audit INSERT must succeed together — use a transaction
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE alerts
        SET  is_active         = ${isActive},
             ai_verified       = true,
             ai_confidence     = ${aiConfidence},
             ai_summary        = ${aiSummary},
             needs_push_notify = ${needsPushNotify}
        WHERE id = ${alertId}
      `);

      await tx.execute(sql`
        INSERT INTO review_decisions
          (reviewer_id, reviewer_email, target_type, target_id, action, rationale, before_state, after_state)
        VALUES (
          ${reviewerId},
          ${session.user.email ?? ''},
          'alert',
          ${alertId},
          ${action === 'verify' ? 'publish' : 'reject'},
          ${rationale ?? null},
          ${JSON.stringify(beforeState)}::jsonb,
          ${JSON.stringify(afterState)}::jsonb
        )
      `);
    });
  } catch (err) {
    console.error('[override] Transaction failed:', err);
    return NextResponse.json({ error: 'Database error — override not applied' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alertId, action });
}
