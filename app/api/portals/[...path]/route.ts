import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [portalType, token] = path;
  const db = createServerClient();

  try {
    // GET /api/portals/owner/:token
    if (portalType === 'owner' && token) {
      const { data } = await db.from('pay_applications').select('*, projects(*)').eq('owner_approval_token', token).single();
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const pa = data as any;
      return NextResponse.json({
        approval: {
          amount: pa.current_payment_due || 0,
          title: `Pay Application #${pa.app_number}`,
          project: pa.projects?.name || 'Project',
        },
        payApp: pa,
        project: pa.projects,
      });
    }

    // GET /api/portals/sub/:token
    if (portalType === 'sub' && token && path.length === 2) {
      const { data } = await db.from('bid_package_invites').select('*, bid_packages(*, projects(*), bid_package_items(*))').eq('token', token).single();
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const invite = data as any;
      const pkg = invite.bid_packages;
      return NextResponse.json({
        package: {
          ...pkg,
          projectName: pkg?.projects?.name,
          items: pkg?.bid_package_items || [],
          invite: { status: invite.status },
        },
      });
    }

    // GET /api/portals/w9/:token — handled by specific route file
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [portalType, token, subPath] = path;
  const db = createServerClient();

  try {
    // POST /api/portals/owner/:token
    // Live pay_applications columns (verified): owner_approval_token (text),
    // status (text), approval_notes (text). The owner portal looks up the row
    // by owner_approval_token and records the decision into status +
    // approval_notes. All three columns exist in the live schema.
    if (portalType === 'owner' && token) {
      const body = await req.json();
      const { decision, notes } = body;
      const newStatus = decision === 'approved' ? 'certified' : 'draft';
      await db.from('pay_applications').update({ status: newStatus, approval_notes: notes }).eq('owner_approval_token', token);
      return NextResponse.json({ success: true });
    }

    // POST /api/portals/sub/:token/lien-waiver
    // Live lien_waivers columns (verified): token (uuid), status (text),
    // signed_at (timestamptz), signature_method (text). The waiver is matched
    // by token; the captured signature is recorded as signature_method='portal'
    // because the live schema has no jsonb column for raw signature data.
    if (portalType === 'sub' && token && subPath === 'lien-waiver') {
      await req.json().catch(() => ({}));
      await db.from('lien_waivers').update({ status: 'signed', signed_at: new Date().toISOString(), signature_method: 'portal' }).eq('token', token);
      return NextResponse.json({ success: true });
    }

    // POST /api/portals/w9/:token — handled by specific route file
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
