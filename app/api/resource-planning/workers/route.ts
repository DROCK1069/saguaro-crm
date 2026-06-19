import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trade = searchParams.get('trade');

  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ workers: [], source: 'unauth' }, { status: 401 });

    const db = createServerClient();
    let query = db.from('workers').select('*').eq('tenant_id', user.tenantId).order('name', { ascending: true });
    if (trade) query = query.eq('trade', trade);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ workers: data || [], source: 'live' });
  } catch {
    return NextResponse.json({ workers: [], source: 'error' });
  }
}
