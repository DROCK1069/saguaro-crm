import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/resource-planning/assignments?projectId=&date=&week=
 * Returns crew assignments for a project/date or a full week.
 *
 * POST creates a new crew assignment.
 * PATCH updates an existing assignment (status, task, time).
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const date = searchParams.get('date');
  const week = searchParams.get('week');
  if (!projectId) return NextResponse.json({ assignments: [] });

  const db = createServerClient() as any;
  let query = db.from('crew_assignments').select('*, workers(name, trade)')
    .eq('project_id', projectId).eq('tenant_id', user.tenantId)
    .order('date').order('start_time');

  if (week) {
    const start = new Date(week);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    query = query.gte('date', start.toISOString().slice(0, 10)).lte('date', end.toISOString().slice(0, 10));
  } else if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.project_id || !body.worker_id || !body.date) {
    return NextResponse.json({ error: 'project_id, worker_id, and date required' }, { status: 400 });
  }

  const db = createServerClient() as any;
  const { data, error } = await db.from('crew_assignments').insert({
    tenant_id: user.tenantId,
    project_id: body.project_id,
    worker_id: body.worker_id,
    date: body.date,
    task: body.task || null,
    trade: body.trade || null,
    start_time: body.start_time || null,
    end_time: body.end_time || null,
    status: body.status || 'assigned',
    notes: body.notes || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: any = { updated_at: new Date().toISOString() };
  if (body.task !== undefined) updates.task = body.task;
  if (body.status) updates.status = body.status;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;
  if (body.notes !== undefined) updates.notes = body.notes;

  const db = createServerClient() as any;
  const { data, error } = await db.from('crew_assignments').update(updates)
    .eq('id', body.id).eq('tenant_id', user.tenantId).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}
