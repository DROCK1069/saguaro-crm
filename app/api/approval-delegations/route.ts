import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * /api/approval-delegations — backs the "Delegation" tab of
 * app/app/approval-workflows/page.tsx.
 *
 * approval_delegations columns: id, tenant_id, from_user, to_user,
 * start_date (date), end_date (date), reason, active, created_at.
 */

// GET /api/approval-delegations -> { delegations: [...] }
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ delegations: [] }, { status: 401 });
  try {
    const db = createServerClient() as unknown as SupabaseClient;
    const { data, error } = await db
      .from('approval_delegations')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ delegations: data ?? [] });
  } catch {
    return NextResponse.json({ delegations: [] });
  }
}

// POST /api/approval-delegations -> { delegation }
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const db = createServerClient() as unknown as SupabaseClient;
    const row: Record<string, unknown> = {
      tenant_id: user.tenantId,
      from_user: body.from_user ?? body.fromUser ?? user.email ?? 'You',
      to_user: body.to_user ?? body.toUser ?? null,
      start_date: body.start_date ?? body.startDate ?? null,
      end_date: body.end_date ?? body.endDate ?? null,
      reason: body.reason ?? null,
      active: body.active ?? true,
    };
    const { data, error } = await db
      .from('approval_delegations')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ delegation: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
