import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();
    // Whitelist each invite to live portal_users columns to avoid inserting
    // non-existent keys (portal_type is a real column; arbitrary invite keys
    // are not).
    const cols = ['project_id', 'name', 'email', 'company', 'role', 'status', 'token', 'invited_at', 'permissions'];
    const invites = (body.invites || []).map((invite: any) => {
      const row: Record<string, any> = {
        tenant_id: user.tenantId,
        portal_type: 'sub',
      };
      for (const key of cols) {
        if (invite[key] !== undefined) row[key] = invite[key];
      }
      return row;
    });
    const { data, error } = await db
      .from('portal_users')
      .insert(invites)
      .select();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
