import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    // portal_messages has no portal_type column; messages are scoped by tenant
    // (and optionally project/session). The previous portal_type filter does not
    // exist in the live schema and has been removed.
    const db_query = db
      .from('portal_messages')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    const { data, error } = await db_query;
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
    // Whitelist to live portal_messages columns (no portal_type column exists).
    // Built as a Partial so we only set fields the client supplied — preserving
    // the prior behavior where missing NOT NULL columns (sender_name, content)
    // surface as a DB error rather than being silently defaulted.
    const row: Partial<TablesInsert<'portal_messages'>> = { tenant_id: user.tenantId };
    if (body.project_id !== undefined) row.project_id = body.project_id;
    if (body.session_id !== undefined) row.session_id = body.session_id;
    if (body.sender_name !== undefined) row.sender_name = body.sender_name;
    if (body.sender_type !== undefined) row.sender_type = body.sender_type;
    if (body.content !== undefined) row.content = body.content;
    if (body.attachments !== undefined) row.attachments = body.attachments;
    const { data, error } = await db
      .from('portal_messages')
      .insert(row as TablesInsert<'portal_messages'>)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
