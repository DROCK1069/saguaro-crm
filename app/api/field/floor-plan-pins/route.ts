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
    const drawingId = searchParams.get('drawing_id');
    const pinType = searchParams.get('pin_type');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const db = createServerClient();
    let query = db
      .from('floor_plan_pins')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });

    if (drawingId) query = query.eq('drawing_id', drawingId);
    if (pinType) query = query.eq('pin_type', pinType);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to list pins', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ pins: data || [] });
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
    const {
      project_id,
      drawing_id,
      pin_type,
      x_percent,
      y_percent,
      label,
      description,
      linked_item_type,
      linked_item_id,
      color,
      icon,
    } = body;

    if (!project_id || !drawing_id || x_percent == null || y_percent == null) {
      return NextResponse.json(
        { error: 'project_id, drawing_id, x_percent, and y_percent are required' },
        { status: 400 }
      );
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('floor_plan_pins')
      .insert({
        tenant_id: user.tenantId,
        project_id,
        drawing_id,
        pin_type: pin_type || 'general',
        x_percent,
        y_percent,
        label: label || null,
        description: description || null,
        linked_item_type: linked_item_type || null,
        linked_item_id: linked_item_id || null,
        color: color || null,
        icon: icon || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create pin', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ pin: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
