import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/safety/talks?projectId=  -> { talks: [...] }  (toolbox talks)
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ talks: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || searchParams.get('project_id');
  try {
    const db = createServerClient();
    let q = db.from('toolbox_talks').select('*').eq('tenant_id', user.tenantId).order('talk_date', { ascending: false });
    if (projectId) q = q.eq('project_id', projectId);
    const { data, error } = await q;
    if (error) throw error;
    // Map to the shape the mobile app expects (conducted_by <- presenter).
    const talks = (data || []).map((t: Record<string, any>) => ({
      ...t,
      conducted_by: t.conducted_by ?? t.presenter ?? '',
      notes: t.notes ?? t.content ?? '',
    }));
    return NextResponse.json({ talks });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, talks: [] }, { status: 500 });
  }
}

// POST /api/safety/talks  -> log a toolbox talk
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, any>));
    const db = createServerClient();
    const row: Record<string, unknown> = {
      tenant_id: user.tenantId,
      project_id: body.project_id,
      topic: body.topic || '',
      presenter: body.conducted_by || body.presenter || '',
      attendee_count: body.attendee_count ?? 0,
      talk_date: body.talk_date || new Date().toISOString(),
      content: body.notes || body.content || '',
    };
    const { data, error } = await db.from('toolbox_talks').insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, talk: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
