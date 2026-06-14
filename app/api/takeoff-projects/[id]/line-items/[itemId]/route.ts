import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('takeoff_line_items')
      .select('*')
      .eq('id', itemId)
      .eq('takeoff_project_id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ lineItem: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    // Fields that map directly to real columns on takeoff_line_items
    const directFields = [
      'description', 'csi_code', 'csi_division', 'csi_description',
      'category', 'quantity', 'unit', 'notes', 'sort_order',
    ];
    // Generic cost aliases -> real column names (per codebase export-route convention)
    const costAliasMap: Record<string, string> = {
      unit_cost: 'unit_material_cost',
      material_cost: 'total_material',
      labor_cost: 'total_labor',
      equipment_cost: 'total_equipment',
    };
    const fields: Record<string, any> = {};
    for (const k of directFields) {
      if (body[k] !== undefined) fields[k] = body[k];
    }
    for (const [alias, col] of Object.entries(costAliasMap)) {
      if (body[alias] !== undefined) fields[col] = body[alias];
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('takeoff_line_items')
      .update(fields)
      .eq('id', itemId)
      .eq('takeoff_project_id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ lineItem: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();
    const { error } = await db
      .from('takeoff_line_items')
      .delete()
      .eq('id', itemId)
      .eq('takeoff_project_id', id)
      .eq('tenant_id', user.tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
