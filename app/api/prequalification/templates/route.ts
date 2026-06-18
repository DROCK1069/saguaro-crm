import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('prequalification_templates')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();
    const ALLOWED_TEMPLATE_COLUMNS = [
      'name', 'description', 'questions', 'scoring_criteria', 'is_default',
    ];
    const insertRow: Partial<TablesInsert<'prequalification_templates'>> = {};
    for (const k of ALLOWED_TEMPLATE_COLUMNS) {
      if (body[k] !== undefined) (insertRow as Record<string, any>)[k] = body[k];
    }
    const { data, error } = await db
      .from('prequalification_templates')
      .insert({ ...insertRow, tenant_id: user.tenantId } as TablesInsert<'prequalification_templates'>)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
