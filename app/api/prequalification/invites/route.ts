import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('prequalification_invites')
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
    const ALLOWED_INVITE_COLUMNS = [
      'template_id', 'sub_id', 'sub_email', 'sub_name', 'token', 'status', 'sent_at', 'completed_at',
    ];
    const insertRow: Record<string, any> = {};
    for (const k of ALLOWED_INVITE_COLUMNS) {
      if (body[k] !== undefined) insertRow[k] = body[k];
    }
    const { data, error } = await db
      .from('prequalification_invites')
      .insert({ ...insertRow, tenant_id: user.tenantId } as Database['public']['Tables']['prequalification_invites']['Insert'])
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
