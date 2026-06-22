import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { lineItemWriteFields, normalizeLineItem, normalizeLineItems } from '@/lib/takeoff-line-item';
import type { Database } from '@/lib/database.types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sheetId = searchParams.get('sheet_id');

  try {
    const db = createServerClient();
    const query = db
      .from('takeoff_line_items')
      .select('*')
      .eq('takeoff_id', id)
      .eq('tenant_id', user.tenantId)
      .order('sort_order', { ascending: true });

    // Line items are not directly tied to a sheet (no sheet_id column on
    // takeoff_line_items), so a sheet_id query param is intentionally ignored.
    void sheetId;

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ lineItems: normalizeLineItems(data || []) });
  } catch (err) {
    console.error('[takeoff-projects/[id]/line-items] GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { description } = body;

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const { fields, metaPatch } = lineItemWriteFields(body);
    const record: Record<string, any> = {
      ...fields,
      description,
      takeoff_id: id,
      tenant_id: user.tenantId,
    };
    if (Object.keys(metaPatch).length > 0) record.metadata = metaPatch;

    const db = createServerClient();
    const { data, error } = await db
      .from('takeoff_line_items')
      .insert(record as Database['public']['Tables']['takeoff_line_items']['Insert'])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ lineItem: normalizeLineItem(data) }, { status: 201 });
  } catch (err) {
    console.error('[takeoff-projects/[id]/line-items] POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
