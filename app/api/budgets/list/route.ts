import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const projectId = req.nextUrl.searchParams.get('projectId');

    let query = supabase.from('budgets').select('*').order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query.limit(20);

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list budgets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
