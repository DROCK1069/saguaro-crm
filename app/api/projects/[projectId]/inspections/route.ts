import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ inspections: [] }, { status: 200 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ inspections: data || [] });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[project/inspections] error:', msg);
    return NextResponse.json({ error: `Failed to fetch inspections: ${msg}` }, { status: 500 });
  }
}
