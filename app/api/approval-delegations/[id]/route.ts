import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Single approval delegation.
 * PATCH  /api/approval-delegations/{id} -> toggle active / edit fields
 * DELETE /api/approval-delegations/{id} -> delete
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const db = createServerClient() as unknown as SupabaseClient;
    const updates: Record<string, unknown> = {};
    if (body.active !== undefined) updates.active = body.active;
    if (body.to_user !== undefined) updates.to_user = body.to_user;
    else if (body.toUser !== undefined) updates.to_user = body.toUser;
    if (body.from_user !== undefined) updates.from_user = body.from_user;
    else if (body.fromUser !== undefined) updates.from_user = body.fromUser;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    else if (body.startDate !== undefined) updates.start_date = body.startDate;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    else if (body.endDate !== undefined) updates.end_date = body.endDate;
    if (body.reason !== undefined) updates.reason = body.reason;
    const { data, error } = await db
      .from('approval_delegations')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ delegation: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient() as unknown as SupabaseClient;
    const { error } = await db
      .from('approval_delegations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
