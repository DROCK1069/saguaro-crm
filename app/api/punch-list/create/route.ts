import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  if (!body.projectId && !body.project_id) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    const db = createServerClient();
    const projectId = (body.projectId || body.project_id) as string;

    // Assign the next per-project item number (punch_list.item_number).
    let item_number = 1;
    try {
      const { data: last } = await db
        .from('punch_list')
        .select('item_number')
        .eq('tenant_id', user.tenantId)
        .eq('project_id', projectId)
        .order('item_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      item_number = (Number((last as Record<string, unknown> | null)?.item_number) || 0) + 1;
    } catch { /* default to 1 */ }

    const row = {
      project_id:  projectId,
      tenant_id:   user.tenantId,
      item_number,
      title:       String(body.title       || ''),
      description: String(body.description || ''),
      location:    String(body.location    || ''),
      trade:       String(body.trade       || 'General Contractor'),
      priority:    String(body.priority    || 'Medium'),
      status:      String(body.status      || 'open'),
      due_date:    (body.due_date as string | null) || null,
      notes:       String(body.notes       || ''),
    };

    const { data, error } = await db
      .from('punch_list')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, item: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
