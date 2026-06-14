import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

async function getPortalSession(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-portal-token');
  if (!token) return null;

  const db = createServerClient();
  const { data: session } = await db
    .from('portal_client_sessions')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();

  return session;
}

/** GET — list punch items */
export async function GET(req: NextRequest) {
  try {
    const session = await getPortalSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();
    const status = req.nextUrl.searchParams.get('status');

    let query = db
      .from('portal_punch_items')
      .select('*')
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: items, error } = await query;
    if (error) throw error;

    // Summary counts
    const all = items || [];
    const summary = {
      total: all.length,
      open: all.filter((i: any) => i.status === 'open').length,
      in_progress: all.filter((i: any) => i.status === 'in_progress').length,
      completed: all.filter((i: any) => i.status === 'completed').length,
      signed_off: all.filter((i: any) => i.status === 'signed_off').length,
    };

    return NextResponse.json({ items: all, summary });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — client sign-off on a punch item */
export async function POST(req: NextRequest) {
  try {
    const session = await getPortalSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { item_id, signature_data, notes } = body;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    const db = createServerClient();

    // Verify item exists and belongs to this project
    const { data: existing, error: fetchError } = await db
      .from('portal_punch_items')
      .select('id, status')
      .eq('id', item_id)
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Punch item not found' }, { status: 404 });
    }

    if (existing.status !== 'completed') {
      return NextResponse.json(
        { error: 'Item must be in completed status before client sign-off' },
        { status: 400 }
      );
    }

    // Live portal_punch_items columns: title, description, location, status,
    // priority, photo_urls, reported_by, completed_at, updated_at. There is no
    // signed_off_by / signed_off_at / signature_data / signoff_notes column (and
    // no jsonb to fold them into), so only the status transition is persisted and
    // completed_at/updated_at are stamped. NOTE: client sign-off identity,
    // signature image, and sign-off notes are not stored — see flagged item.
    const { data: updated, error: updateError } = await db
      .from('portal_punch_items')
      .update({
        status: 'signed_off',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
