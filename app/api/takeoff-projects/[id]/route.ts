import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { signFields } from '@/lib/storage-signing';
import { normalizeLineItems } from '@/lib/takeoff-line-item';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();

    const [projectRes, sheetsRes, lineItemsRes] = await Promise.all([
      db
        .from('takeoff_projects')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', user.tenantId)
        .single(),
      db
        .from('takeoff_sheets')
        .select('*')
        .eq('takeoff_project_id', id)
        .eq('tenant_id', user.tenantId)
        .order('sort_order', { ascending: true }),
      db
        // takeoff_line_items has NO FK to takeoff_assemblies, so an embedded
        // join would make PostgREST 400. Select the row columns only.
        .from('takeoff_line_items')
        .select('*')
        .eq('takeoff_id', id)
        .eq('tenant_id', user.tenantId)
        .order('sort_order', { ascending: true }),
    ]);

    if (projectRes.error || !projectRes.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (sheetsRes.error) throw sheetsRes.error;
    if (lineItemsRes.error) throw lineItemsRes.error;

    // The `blueprints` bucket is private — sign the stored public URLs so the
    // viewer's <img> can actually load them.
    const sheets = await signFields(
      (sheetsRes.data || []) as Record<string, any>[],
      ['file_url', 'thumbnail_url'],
    );

    return NextResponse.json({
      takeoffProject: projectRes.data,
      sheets,
      lineItems: normalizeLineItems((lineItemsRes.data || []) as Record<string, any>[]),
    });
  } catch (err) {
    console.error('[takeoff-projects/[id]] GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const allowed = [
      'name', 'description', 'status', 'overhead_pct', 'profit_pct',
      'contingency_pct', 'sell_price', 'gross_margin', 'total_cost',
      'material_cost', 'labor_cost', 'equipment_cost', 'notes',
      'locked', 'locked_at', 'locked_by',
    ];
    const fields: Record<string, any> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) fields[k] = body[k];
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('takeoff_projects')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ takeoffProject: data });
  } catch (err) {
    console.error('[takeoff-projects/[id]] PATCH', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();
    const { error } = await db
      .from('takeoff_projects')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[takeoff-projects/[id]] DELETE', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
