import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();

    // Only real selections columns are updatable.
    const allowed = ['category','allowance','status','selected_by','due_date','notes','vendor','lead_time','photo_url','variance'];
    const fields: Record<string, any> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) fields[k] = body[k];
    }
    // Map the page's field names onto real columns.
    if (body.item !== undefined) fields.item_name = body.item;
    else if (body.item_name !== undefined) fields.item_name = body.item_name;
    if (body.cost !== undefined) fields.selected_amount = Number(body.cost) || 0;
    else if (body.selected_amount !== undefined) fields.selected_amount = Number(body.selected_amount) || 0;

    // Fold product attributes (no own columns, no jsonb sink) into description.
    const descParts = [
      body.manufacturer ? `Manufacturer: ${body.manufacturer}` : '',
      body.model ? `Model: ${body.model}` : '',
      body.color ? `Color: ${body.color}` : '',
      body.finish ? `Finish: ${body.finish}` : '',
      body.link ? `Link: ${body.link}` : '',
    ].filter(Boolean);
    if (descParts.length) fields.description = descParts.join(' | ');
    // owner_approved has no column on selections and is dropped.

    const { error } = await db
      .from('selections')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { error } = await db.from('selections').delete().eq('id', id).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
