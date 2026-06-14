import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data: project } = await supabase.from('projects').select('id').eq('id', params.projectId).eq('tenant_id', user.tenantId).single();
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { data, error } = await supabase.from('warranty_claims').select('*').eq('project_id', params.projectId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ claims: data ?? [] });
  } catch { return NextResponse.json({ claims: [] }); }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const body = await req.json();
    // warranty_claims has no claim_number/category/priority/assigned_trade/
    // assigned_contractor/scheduled_date/notes/created_by columns. Map the ones with
    // clear homes (priority->severity, assigned_trade->trade, assigned_contractor->
    // assigned_to, reported_date->created_at, photos->photo_urls) and drop the rest.
    const { data, error } = await supabase.from('warranty_claims').insert({
      tenant_id: user.tenantId, project_id: params.projectId,
      title: body.title, description: body.description,
      location: body.location || null,
      reported_by: body.reported_by || null,
      ...(body.reported_date ? { created_at: body.reported_date } : {}),
      severity: body.priority || 'medium', status: body.status || 'submitted',
      trade: body.assigned_trade || null, assigned_to: body.assigned_contractor || null,
      warranty_expiry: body.warranty_expiry || null,
      photo_urls: body.photos || [],
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ claim: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
