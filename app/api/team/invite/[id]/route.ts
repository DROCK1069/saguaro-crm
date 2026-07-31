import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { sendInviteTeamMember } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://saguarocontrol.net';

/**
 * DELETE /api/team/invite/[id]
 * Cancel a pending invite. Tenant-scoped: the invite MUST belong to the caller's
 * tenant (the `.eq('tenant_id', ...)` filter makes a cross-tenant cancel a no-op).
 * We soft-cancel (status='cancelled') rather than hard-delete so the record stays
 * auditable.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Cancelling an invite changes who can access the tenant — access-control action.
  const g = await requirePermission(req, 'Admin', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const db = createServerClient();
    const { error } = await db
      .from('team_invites')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/team/invite/[id]
 * Resend a pending invite: re-send the invitation email and reset the 7-day clock
 * (created_at = now) so the countdown restarts. The token is intentionally kept
 * the same so any prior copy of the link still works. Tenant-scoped throughout.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requirePermission(req, 'Admin', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const db = createServerClient();

    // Load the invite — MUST belong to this tenant (never touch another tenant's row).
    const { data: invite, error: findErr } = await db
      .from('team_invites')
      .select('id, email, role, token')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (findErr || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Reset the 7-day clock and keep it pending (same token — no regeneration).
    const { error: updErr } = await db
      .from('team_invites')
      .update({ created_at: new Date().toISOString(), status: 'pending' })
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (updErr) throw updErr;

    const acceptUrl = `${APP_URL}/accept-invite?token=${invite.token}`;

    // Best-effort inviter name + company for the email body (mirrors the send route).
    let inviterName = user.email || 'A teammate';
    let companyName = 'your team';
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('full_name, first_name, company')
        .eq('id', user.id)
        .single();
      if (profile) {
        inviterName = (profile as any).full_name || (profile as any).first_name || inviterName; // eslint-disable-line @typescript-eslint/no-explicit-any
        companyName = (profile as any).company || companyName; // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    } catch { /* non-fatal — fall back to defaults */ }

    // Re-send the real invitation email (no-ops gracefully if RESEND_API_KEY is unset).
    await sendInviteTeamMember(invite.email, inviterName, companyName, invite.role || 'member', acceptUrl);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
