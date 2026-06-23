import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/** GET/POST union/prevailing-wage rate classes (classification → base + fringe). */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get('projectId');
  const db = createServerClient() as any;
  let q = db.from('union_rate_classes').select('*').eq('tenant_id', user.tenantId).order('classification');
  if (projectId) q = q.or(`project_id.eq.${projectId},project_id.is.null`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate_classes: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.classification) return NextResponse.json({ error: 'classification required' }, { status: 400 });
  const db = createServerClient() as any;
  const { data, error } = await db.from('union_rate_classes').insert({
    tenant_id: user.tenantId,
    project_id: body.project_id || null,
    classification: body.classification,
    base_rate: body.base_rate || 0,
    fringe_rate: body.fringe_rate || 0,
    effective_date: body.effective_date || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate_class: data }, { status: 201 });
}
