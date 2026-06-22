import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { notFound, serverError } from '@/lib/api-response';
import type { Database } from '@/lib/database.types';

type TakeoffProjectInsert = Database['public']['Tables']['takeoff_projects']['Insert'];
type LineItemInsert = Database['public']['Tables']['takeoff_line_items']['Insert'];

const BATCH_SIZE = 500;

/**
 * POST /api/takeoff/[id]/to-estimate
 *
 * One-way bridge: copy a completed AI takeoff (System A: `takeoffs` +
 * `takeoff_materials`) into the editable manual estimate workspace
 * (System B: `takeoff_projects` + `takeoff_line_items`).
 *
 * Idempotent — the source takeoff id is stored in
 * `takeoff_projects.metadata->>'source_takeoff_id'`; a repeat call returns the
 * existing estimate without duplicating.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const supabase = createServerClient();
    const { id } = await params;

    // 1. Load the source takeoff, scoped to the caller's tenant.
    const { data: takeoff, error: takeoffErr } = await supabase
      .from('takeoffs')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (takeoffErr || !takeoff) {
      return notFound('Takeoff not found');
    }

    // 2. Idempotency — if an estimate already exists for this source takeoff,
    //    return it without duplicating. Scope to tenant.
    const { data: existing } = await supabase
      .from('takeoff_projects')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .eq('metadata->>source_takeoff_id', takeoff.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ takeoffProjectId: existing.id, created: false });
    }

    // 3. Create the editable estimate (takeoff_projects).
    const tpInsert: TakeoffProjectInsert = {
      tenant_id: user.tenantId,
      project_id: takeoff.project_id,
      name: (takeoff.name || 'AI Takeoff') + ' — Estimate',
      status: 'in_progress',
      total_cost: takeoff.total_cost || 0,
      material_cost: takeoff.material_cost || 0,
      labor_cost: takeoff.labor_cost || 0,
      metadata: { source_takeoff_id: takeoff.id },
    };

    const { data: tp, error: tpErr } = await supabase
      .from('takeoff_projects')
      .insert(tpInsert)
      .select('id')
      .single();

    if (tpErr || !tp) throw tpErr || new Error('Failed to create estimate');

    // 4. Load all AI material rows and map them to editable line items.
    const { data: materials, error: matErr } = await supabase
      .from('takeoff_materials')
      .select('*')
      .eq('takeoff_id', takeoff.id)
      .order('sort_order', { ascending: true });

    if (matErr) throw matErr;

    const rows: LineItemInsert[] = (materials || []).map((m) => ({
      takeoff_id: tp.id,
      tenant_id: user.tenantId,
      project_id: takeoff.project_id,
      csi_division: m.csi_division,
      csi_code: m.csi_code,
      csi_description: m.csi_name,
      description: m.description,
      quantity: m.quantity,
      unit: m.unit,
      unit_material_cost: m.unit_cost,
      unit_labor_cost: m.labor_unit_cost || 0,
      sort_order: m.sort_order || 0,
      category: m.csi_division,
      // total_material / total_labor are GENERATED columns (qty * unit) — never written.
      metadata: { source_material_id: m.id, material_cost: m.total_cost, labor_cost: m.total_labor_cost || 0 },
    }));

    // 5. Bulk insert in batches.
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insErr } = await supabase.from('takeoff_line_items').insert(batch);
      if (insErr) throw insErr;
    }

    return NextResponse.json({
      takeoffProjectId: tp.id,
      created: true,
      lineItems: rows.length,
    });
  } catch (err) {
    return serverError(err);
  }
}
