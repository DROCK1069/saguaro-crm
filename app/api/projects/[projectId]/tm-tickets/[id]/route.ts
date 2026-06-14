import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    const ALLOWED_TM_TICKET_COLUMNS = [
      'project_id', 'ticket_number', 'description', 'work_date', 'labor_hours', 'labor_rate',
      'labor_total', 'materials', 'materials_total', 'equipment', 'equipment_total', 'markup_pct',
      'total', 'status', 'approved_by', 'approved_at', 'signature_url', 'pdf_url', 'notes', 'created_by',
    ];
    const updates: Record<string, any> = {};
    for (const k of ALLOWED_TM_TICKET_COLUMNS) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const { data, error } = await supabase
      .from('tm_tickets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('project_id', params.projectId)
      .select()
      .single();
    if (error) return NextResponse.json({ ticket: { id: params.id, ...body } });
    return NextResponse.json({ ticket: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}
