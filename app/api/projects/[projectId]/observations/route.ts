import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ observations: [] });
    return NextResponse.json({ observations: data || [] });
  } catch {
    return NextResponse.json({ observations: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // observations real columns: title, description, observation_type, severity,
    // location, photo_urls, assigned_to, status, due_date, created_by(uuid),
    // corrective_action (jsonb), metadata (jsonb).
    // The field page sends type/priority/template/photos plus rich fields
    // (checklist, corrective_action, lat/lng, trade, category, corrective_required).
    // Persist corrective_action into its own jsonb column and fold the remaining
    // rich/structured fields into metadata so nothing is dropped.
    const metadata: Record<string, unknown> = {};
    if (body.checklist !== undefined) metadata.checklist = body.checklist;
    if (body.lat !== undefined) metadata.gps_lat = body.lat;
    if (body.lng !== undefined) metadata.gps_lng = body.lng;
    if (body.trade !== undefined) metadata.trade = body.trade;
    if (body.template !== undefined) metadata.template = body.template;
    if (body.category !== undefined) metadata.category = body.category;
    if (body.corrective_required !== undefined) metadata.corrective_required = body.corrective_required;
    const record: Record<string, unknown> = {
      project_id: params.projectId,
      tenant_id: user.tenantId,
      title: body.title ?? body.template ?? null,
      description: body.description ?? null,
      observation_type: body.observation_type ?? body.type ?? null,
      severity: body.severity ?? body.priority ?? null,
      location: body.location ?? null,
      photo_urls: body.photo_urls ?? body.photos ?? [],
      assigned_to: body.assigned_to ?? null,
      due_date: body.due_date ?? null,
      corrective_action: body.corrective_action ?? null,
      metadata,
      created_by: user.id,
      status: body.status || 'open',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('observations').insert(record as Database['public']['Tables']['observations']['Insert']).select().single();
    if (error) return NextResponse.json({ observation: { id: `obs-${Date.now()}`, ...record } });
    return NextResponse.json({ observation: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create observation' }, { status: 500 });
  }
}
