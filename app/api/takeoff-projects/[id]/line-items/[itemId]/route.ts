import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { lineItemWriteFields, normalizeLineItem } from '@/lib/takeoff-line-item';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('takeoff_line_items')
      .select('*')
      .eq('id', itemId)
      .eq('takeoff_id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ lineItem: normalizeLineItem(data) });
  } catch (err) {
    console.error('[takeoff-projects/[id]/line-items/[itemId]] GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { fields, metaPatch } = lineItemWriteFields(body);

    const db = createServerClient();

    // Merge incoming metadata keys onto the existing jsonb so unrelated keys are
    // preserved rather than clobbered.
    if (Object.keys(metaPatch).length > 0) {
      const { data: current } = await db
        .from('takeoff_line_items')
        .select('metadata')
        .eq('id', itemId)
        .eq('takeoff_id', id)
        .eq('tenant_id', user.tenantId)
        .single();
      fields.metadata = { ...((current?.metadata as Record<string, any>) || {}), ...metaPatch };
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await db
      .from('takeoff_line_items')
      .update(fields)
      .eq('id', itemId)
      .eq('takeoff_id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ lineItem: normalizeLineItem(data) });
  } catch (err) {
    console.error('[takeoff-projects/[id]/line-items/[itemId]] PATCH', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();
    const { error } = await db
      .from('takeoff_line_items')
      .delete()
      .eq('id', itemId)
      .eq('takeoff_id', id)
      .eq('tenant_id', user.tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[takeoff-projects/[id]/line-items/[itemId]] DELETE', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
