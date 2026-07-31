import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Use the service-role client and scope by tenant. The previous bare anon
    // client carried no user JWT, so the UPDATE ran as the `anon` role — which
    // has no RLS policy on project_todos — and silently affected 0 rows while
    // still returning success. `.select()` lets us detect a 0-row update and
    // surface a real 404 instead of a fake success.
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('project_todos')
      .update({ status: 'Complete', completed_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('tenant_id', user.tenantId)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[todos/complete] error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
