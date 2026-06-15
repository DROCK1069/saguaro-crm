import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id') || searchParams.get('projectId');
    const status = searchParams.get('status');

    if (!projectId) {
      return NextResponse.json({ deliveries: [] }, { status: 200 });
    }

    const db = createServerClient();
    let query = db
      .from('delivery_tracking')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', user.tenantId)
      .order('eta', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to list deliveries', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ deliveries: data || [] });
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
      supplier,
      description,
      tracking_number,
      carrier,
      expected_date,
      cost_code_id,
      notes,
    } = body;

    if (!project_id || !supplier || !description) {
      return NextResponse.json({ error: 'project_id, supplier, and description are required' }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('delivery_tracking')
      .insert({
        tenant_id: user.tenantId,
        project_id,
        description,
        tracking_number: tracking_number || null,
        carrier_name: carrier || null,
        eta: expected_date || null,
        notes: notes || null,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create delivery', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ delivery: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
