import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    const floorId = searchParams.get('floor_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const db = createServerClient();
    let query = db
      .from('room_progress')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .order('room_name', { ascending: true });

    if (floorId) query = query.eq('floor_id', floorId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to list room progress', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ rooms: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { project_id, room_name, floor_id, trade, status, percent_complete, notes } = body;

    if (!project_id || !room_name) {
      return NextResponse.json({ error: 'project_id and room_name are required' }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('room_progress')
      .insert({
        tenant_id: user.tenantId,
        project_id,
        room_name,
        floor_id: floor_id || null,
        trade: trade || null,
        status: status || 'not_started',
        percent_complete: percent_complete || 0,
        notes: notes || null,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create room progress', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ room: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, percent_complete, notes, trade } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = createServerClient();
    const updates: Record<string, any> = { updated_by: user.id, updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (percent_complete !== undefined) updates.percent_complete = percent_complete;
    if (notes !== undefined) updates.notes = notes;
    if (trade !== undefined) updates.trade = trade;

    const { data, error } = await db
      .from('room_progress')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update room progress', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ room: data });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
