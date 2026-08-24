import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('bid_packages')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[projects/[projectId]/bid-packages] read failed:', error.message);
      return NextResponse.json({ error: 'Failed to load packages', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ packages: data || [] });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[projects/[projectId]/bid-packages] read failed:', detail);
    // A failed read must not render as an empty result — return a real
    // status so the UI can show an error state with a retry.
    return NextResponse.json({ error: 'Failed to load packages', detail }, { status: 500 });
  }
}
