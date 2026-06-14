import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/sub-portal/status
 *   Returns sub portal users with their current status.
 *   Shape: { data: { userId, status }[] }
 *
 * PATCH /api/sub-portal/status
 *   Body: { userId: string, status: 'active' | 'pending' | 'disabled' }
 *   Updates a single sub user's status. Fire-and-forget from the page;
 *   always returns a safe payload so the client never errors.
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('portal_users')
      .select('id, status')
      .eq('tenant_id', user.tenantId)
      .eq('portal_type', 'sub');
    if (error) throw error;
    const rows = (data || []).map((r: any) => ({ userId: r.id, status: r.status || 'pending' }));
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body?.userId;
    const status: string | undefined = body?.status;
    if (!userId || !status) {
      return NextResponse.json({ error: 'userId and status are required' }, { status: 400 });
    }
    const allowed = ['active', 'pending', 'disabled'];
    const nextStatus = allowed.includes(status) ? status : 'pending';

    const db = createServerClient();
    const { data, error } = await db
      .from('portal_users')
      .update({ status: nextStatus })
      .eq('id', userId)
      .eq('tenant_id', user.tenantId)
      .eq('portal_type', 'sub')
      .select('id, status')
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ data: data || { userId, status: nextStatus } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
