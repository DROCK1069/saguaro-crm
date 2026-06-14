import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/safety/incidents?projectId=  -> { incidents: [...] }
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ incidents: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || searchParams.get('project_id');
  try {
    const db = createServerClient();
    let q = db.from('safety_incidents').select('*').eq('tenant_id', user.tenantId).order('incident_date', { ascending: false });
    if (projectId) q = q.eq('project_id', projectId);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ incidents: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, incidents: [] }, { status: 500 });
  }
}

// POST /api/safety/incidents  -> report an incident
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const db = createServerClient();
    const { data, error } = await db
      .from('safety_incidents')
      .insert({ ...body, tenant_id: user.tenantId })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, incident: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
