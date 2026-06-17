import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.projectId || !body.item) {
      return NextResponse.json({ error: 'projectId and item are required' }, { status: 400 });
    }
    const db = createServerClient();

    // selections columns: tenant_id, project_id, category, item_name, description,
    // allowance, selected_amount, variance, status, vendor, lead_time, due_date,
    // selected_by, selected_at, photo_url, notes. The page sends a richer model
    // (item->item_name, cost->selected_amount). There is no jsonb column, so the
    // remaining product attributes (manufacturer/model/color/finish/link) are
    // folded into the free-text `description` column rather than dropped, and
    // owner_approved (no column) is dropped.
    const descParts = [
      body.manufacturer ? `Manufacturer: ${body.manufacturer}` : '',
      body.model ? `Model: ${body.model}` : '',
      body.color ? `Color: ${body.color}` : '',
      body.finish ? `Finish: ${body.finish}` : '',
      body.link ? `Link: ${body.link}` : '',
    ].filter(Boolean);

    const insert: Record<string, unknown> = {
      tenant_id: user.tenantId,
      project_id: body.projectId,
      category: body.category || 'Other',
      item_name: body.item || body.item_name || '',
      selected_amount: Number(body.cost ?? body.selected_amount) || 0,
      allowance: Number(body.allowance) || 0,
      status: body.status || 'pending',
      selected_by: body.selected_by || body.selectedBy || '',
      due_date: body.due_date || null,
      notes: body.notes || '',
    };
    if (descParts.length) insert.description = descParts.join(' | ');

    const { data, error } = await db.from('selections').insert(insert as Database['public']['Tables']['selections']['Insert']).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, selection: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
