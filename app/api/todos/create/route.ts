import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const ALLOWED_TODO_COLUMNS = [
      'tenant_id', 'project_id', 'title', 'description', 'assigned_to', 'due_date',
      'priority', 'status', 'completed_at', 'created_by',
    ];
    const insertRow: Record<string, unknown> = {};
    for (const k of ALLOWED_TODO_COLUMNS) {
      if (body[k] !== undefined) insertRow[k] = body[k];
    }
    const { data, error } = await supabase.from('project_todos').insert(insertRow).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, todo: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[todos/create] error:', msg);
    return NextResponse.json({ error: `Failed to create todo: ${msg}` }, { status: 500 });
  }
}
