import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || searchParams.get('project_id');

  try {
    const db = createServerClient();
    let query = db
      .from('equipment')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('name', { ascending: true });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ equipment: data || [] });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[equipment] error:', msg);
    return NextResponse.json(
      { error: `[equipment] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
