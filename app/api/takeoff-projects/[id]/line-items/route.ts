import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sheetId = searchParams.get('sheet_id');

  try {
    const db = createServerClient();
    let query = db
      .from('takeoff_line_items')
      .select('*')
      .eq('takeoff_project_id', id)
      .eq('tenant_id', user.tenantId)
      .order('sort_order', { ascending: true });

    if (sheetId) query = query.eq('sheet_id', sheetId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ lineItems: data || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { description } = body;

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    // Fields that map directly to real columns on takeoff_line_items
    const directFields = [
      'csi_code', 'csi_division', 'csi_description', 'category',
      'quantity', 'unit', 'notes', 'sort_order',
    ];
    // Generic cost aliases -> real column names (per codebase export-route convention:
    // unit_cost==unit_material_cost, material_cost==total_material, etc.)
    const costAliasMap: Record<string, string> = {
      unit_cost: 'unit_material_cost',
      material_cost: 'total_material',
      labor_cost: 'total_labor',
      equipment_cost: 'total_equipment',
    };
    const record: Record<string, any> = {
      description,
      takeoff_id: id,
      tenant_id: user.tenantId,
    };
    for (const k of directFields) {
      if (body[k] !== undefined) record[k] = body[k];
    }
    for (const [alias, col] of Object.entries(costAliasMap)) {
      if (body[alias] !== undefined) record[col] = body[alias];
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('takeoff_line_items')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ lineItem: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
