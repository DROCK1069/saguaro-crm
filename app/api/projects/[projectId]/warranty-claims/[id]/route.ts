import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const g = await requirePermission(req, 'Safety', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const supabase = createServerClient();
    const body = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // Pass through real columns directly. communication_log (jsonb) is sent by the
    // page as the full updated array, so this is a replace.
    const direct = ['title','description','location','status','resolution','communication_log'];
    for (const k of direct) if (body[k] !== undefined) updates[k] = body[k];
    // Map UI field names to their warranty_claims columns; drop the rest
    // (category/scheduled_date/cost/covered_under_warranty/notes have no column).
    if (body.priority !== undefined) updates.severity = body.priority;
    if (body.assigned_trade !== undefined) updates.trade = body.assigned_trade;
    if (body.assigned_contractor !== undefined) updates.assigned_to = body.assigned_contractor;
    if (body.completed_date !== undefined) updates.resolved_at = body.completed_date;
    if (body.photos !== undefined) updates.photo_urls = body.photos;
    const { data, error } = await supabase.from('warranty_claims').update(updates).eq('id', params.id).eq('project_id', params.projectId).eq('tenant_id', user.tenantId).select().single();
    if (error) throw error;
    return NextResponse.json({ claim: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
