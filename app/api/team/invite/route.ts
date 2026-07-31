import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';
import { sendInviteTeamMember } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://saguarocontrol.net';

// Reads must never be frozen at their first result (App Router caches GET by default).
export const dynamic = 'force-dynamic';

/**
 * GET /api/team/invite
 * List this tenant's PENDING invites (tenant-scoped), newest first. Powers the
 * "Pending Invites" panel in the Roles & Access → User Assignments tab. There is
 * no expires_at column — invites are treated as expiring 7 days after created_at,
 * computed client-side from created_at.
 */
export async function GET(req: NextRequest) {
  // Listing who has a standing invite into the tenant is an access-control read.
  const g = await requirePermission(req, 'Admin', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('team_invites')
      .select('id, email, role, created_at, invited_by')
      .eq('tenant_id', user.tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ invites: data ?? [] });
  } catch {
    return NextResponse.json({ invites: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Inviting a teammate expands who can access the tenant — access-control action.
  const g = await requirePermission(req, 'Admin', 'Full');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const body = await req.json().catch(() => ({}));
    const { email, name, role = 'member', projectId } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const db = createServerClient();
    const tenantId = user.tenantId;

    // Secure, single-use accept token (persisted so the invitee can actually accept).
    const token = randomBytes(24).toString('hex');

    // Insert using ONLY real team_invites columns. `name` is NOT a column on this
    // table — persisting it here previously caused the whole insert to fail while
    // the route still (wrongly) reported success. We store the token so the invite
    // is real, and surface any DB error honestly instead of swallowing it.
    const { data: invite, error: insertErr } = await db
      .from('team_invites')
      .insert({
        tenant_id: tenantId,
        email,
        role,
        project_id: projectId || null,
        invited_by: user.id,
        token,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr || !invite) {
      console.error('[team/invite] insert failed:', insertErr);
      return NextResponse.json(
        { error: insertErr?.message || 'Failed to create invite' },
        { status: 500 },
      );
    }

    const acceptUrl = `${APP_URL}/accept-invite?token=${token}`;

    // Best-effort lookup of inviter name + company for the email body.
    let inviterName = user.email || 'A teammate';
    let companyName = 'your team';
    try {
      const { data: profile } = await db
        .from('profiles')
        .select('full_name, first_name, company')
        .eq('id', user.id)
        .single();
      if (profile) {
        inviterName = (profile as any).full_name || (profile as any).first_name || inviterName;
        companyName = (profile as any).company || companyName;
      }
    } catch { /* non-fatal — fall back to defaults */ }

    // Send the real invitation email (no-ops gracefully if RESEND_API_KEY is unset).
    await sendInviteTeamMember(email, inviterName, companyName, role, acceptUrl);

    // In-app notification for the inviter's org.
    await createNotification(
      tenantId,
      user.id,
      'sub_added',
      `Team invite sent to ${name || email}`,
      `${email} has been invited to join your team as ${role}.`,
      projectId
        ? `${APP_URL}/app/projects/${projectId}/team`
        : `${APP_URL}/app`,
    );

    return NextResponse.json({ success: true, invite, acceptUrl });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
