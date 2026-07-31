import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ projects: [], source: 'unauth' }, { status: 401 });
    }
    const db = createServerClient();
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('tenant_id', user.tenantId)
      // Exclude soft-deleted / archived projects. Legacy rows have NULL flags,
      // so keep NULL (treated as not-archived) and drop only explicit `true`.
      .or('is_archived.is.null,is_archived.eq.false')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ projects: data || [], source: 'live' });
  } catch {
    return NextResponse.json({ projects: [], source: 'error' });
  }
}
