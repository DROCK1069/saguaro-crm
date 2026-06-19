import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const ALLOWED_INSPECTION_COLUMNS = [
      'project_id', 'inspection_type', 'inspector_name', 'inspection_date',
      'score', 'findings', 'corrective_actions', 'status', 'pdf_url', 'notes',
    ];
    const insertRow: Record<string, unknown> = {};
    for (const k of ALLOWED_INSPECTION_COLUMNS) {
      if (body[k] !== undefined) insertRow[k] = body[k];
    }
    // tenant_id is NOT NULL with no default. This anon client + custom Bearer auth
    // means the auto_set_tenant_id trigger cannot resolve auth.uid(), so set it
    // explicitly from the authenticated user (never trust body.tenant_id).
    insertRow.tenant_id = user.tenantId;
    const { data, error } = await supabase.from('safety_inspections').insert(insertRow).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, inspection: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[safety/inspections/create] error:', msg);
    return NextResponse.json({ error: `Failed to create safety inspection: ${msg}` }, { status: 500 });
  }
}
