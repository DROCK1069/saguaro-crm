import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const db = createServerClient();
    // Resolve the pay app by its owner-approval token. Fetch project + line
    // items with separate queries: schedule_of_values.pay_app_id has no FK
    // constraint, so a PostgREST embed (schedule_of_values(*)) errors out.
    const { data: pa, error } = await db
      .from('pay_applications')
      .select('*')
      .eq('owner_approval_token', token)
      .single();
    if (error || !pa) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [projectRes, sovRes] = await Promise.all([
      pa.project_id
        ? db.from('projects').select('*').eq('id', pa.project_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from('schedule_of_values').select('*').eq('pay_app_id', pa.id).order('sort_order', { ascending: true }),
    ]);

    return NextResponse.json({
      payApp: pa,
      project: projectRes.data || null,
      lineItems: sovRes.data || [],
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const body = await req.json();
    const { action, note } = body;
    const db = createServerClient();

    // Check if this pay app has already been reviewed (prevent token reuse).
    // Live column is approved_at (not owner_approved_at).
    const { data: existing } = await db
      .from('pay_applications')
      .select('status, approved_at')
      .eq('owner_approval_token', token)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Pay application not found' }, { status: 404 });
    }

    if (existing.approved_at) {
      return NextResponse.json({ error: 'This pay application has already been reviewed.' }, { status: 409 });
    }

    const newStatus = action === 'approved' ? 'certified' : 'draft';
    // Live pay_applications columns: status, approval_notes, approved_at.
    // owner_notes -> approval_notes, owner_approved_at -> approved_at.
    // NOTE: pay_applications has no owner_approval_token column, so the .eq()
    // lookup below cannot resolve a row in the live schema — see flagged item.
    const { error } = await db
      .from('pay_applications')
      .update({
        status: newStatus,
        approval_notes: note,
        approved_at: new Date().toISOString(),
      })
      .eq('owner_approval_token', token);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
