import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id') || searchParams.get('projectId');
  const status = searchParams.get('status');
  if (!projectId) return NextResponse.json({ deliveries: [] });

  const db = createServerClient() as any;
  let query = db.from('delivery_tracking').select('*')
    .eq('project_id', projectId).eq('tenant_id', user.tenantId)
    .order('eta', { ascending: true });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deliveries: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const projectId = body.project_id || body.projectId;
  if (!projectId || !body.description) {
    return NextResponse.json({ error: 'project_id and description required' }, { status: 400 });
  }

  const db = createServerClient() as any;
  const { data, error } = await db.from('delivery_tracking').insert({
    tenant_id: user.tenantId,
    project_id: projectId,
    description: body.description,
    supplier: body.supplier || body.carrier || null,
    carrier_name: body.carrier || body.carrier_name || null,
    tracking_number: body.tracking_number || null,
    eta: body.eta || body.expected_date || null,
    contact_phone: body.contact_phone || null,
    po_number: body.po_number || body.poNumber || null,
    qty_ordered: body.qty_ordered || body.qtyOrdered || null,
    qty_received: body.qty_received || body.qtyReceived || null,
    condition: body.condition || 'Accepted',
    received_by: body.received_by || body.receivedBy || null,
    photo_urls: body.photo_urls || body.photoUrls || [],
    cost_code_id: body.cost_code_id || null,
    notes: body.notes || null,
    status: body.status || 'scheduled',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ delivery: data }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = createServerClient() as any;
  const updates: any = { updated_at: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.actual_arrival) updates.actual_arrival = body.actual_arrival;
  if (body.received_by) updates.received_by = body.received_by;
  if (body.condition) updates.condition = body.condition;
  if (body.qty_received !== undefined) updates.qty_received = body.qty_received;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.photo_urls) updates.photo_urls = body.photo_urls;

  const { data, error } = await db.from('delivery_tracking')
    .update(updates)
    .eq('id', body.id).eq('tenant_id', user.tenantId)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ delivery: data });
}
