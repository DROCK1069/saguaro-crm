import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ notifications: [] });
    return NextResponse.json({ notifications: data || [] });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  try {
    const body = await req.json();
    const supabase = createServerClient();

    if (body.mark_all_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('project_id', params.projectId)
        .eq('user_id', user.id)
        .eq('read', false);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      // Scope to this user so a spoofed id can't flip another user's notification,
      // and surface a real error instead of always reporting success.
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', body.id)
        .eq('user_id', user.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
