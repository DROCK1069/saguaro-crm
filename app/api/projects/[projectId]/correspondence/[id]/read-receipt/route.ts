import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[projectId]/correspondence/[id]/read-receipt
 * Marks an inbound correspondence item as read by the current user.
 * Called by app/field/correspondence/page.tsx markRead().
 *
 * Request body: { read_at?: string }  (ISO timestamp; defaults to now)
 * Response: { success: true }
 *
 * Records into correspondence_read_receipts
 * (columns: id, correspondence_id, recipient_email, read_at) and best-effort
 * flips the parent correspondence row to status 'Read'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const readAt =
      typeof body?.read_at === 'string' ? body.read_at : new Date().toISOString();
    const recipientEmail = user.email || 'unknown';

    const db = createServerClient();

    // De-dupe: one receipt per (correspondence, recipient). No unique index
    // exists, so check first then insert/update.
    const { data: existing } = await db
      .from('correspondence_read_receipts')
      .select('id')
      .eq('correspondence_id', id)
      .eq('recipient_email', recipientEmail)
      .maybeSingle();

    if (existing?.id) {
      await db
        .from('correspondence_read_receipts')
        .update({ read_at: readAt })
        .eq('id', existing.id);
    } else {
      await db.from('correspondence_read_receipts').insert({
        correspondence_id: id,
        recipient_email: recipientEmail,
        read_at: readAt,
      });
    }

    // Best-effort: reflect read state on the parent item (scoped to project).
    await db
      .from('correspondence')
      .update({ status: 'Read' })
      .eq('id', id)
      .eq('project_id', projectId);

    return NextResponse.json({ success: true });
  } catch {
    // Read receipts are non-critical; never surface a hard error to the field UI.
    return NextResponse.json({ success: true });
  }
}
