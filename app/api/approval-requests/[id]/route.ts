import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Single approval request.
 * PATCH  /api/approval-requests/{id} -> approve / reject / advance:
 *        updates status, current_step and appends a history entry.
 * DELETE /api/approval-requests/{id} -> delete
 *
 * Body for PATCH may include: status, current_step/currentStep, and
 * historyEntry ({ action, decidedBy, decidedAt, comment }) which is appended
 * to the existing history jsonb array. Alternatively a full `history` array
 * may be supplied to replace it outright.
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const db = createServerClient() as unknown as SupabaseClient;

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.current_step !== undefined) updates.current_step = body.current_step;
    else if (body.currentStep !== undefined) updates.current_step = body.currentStep;
    if (body.total_steps !== undefined) updates.total_steps = body.total_steps;
    else if (body.totalSteps !== undefined) updates.total_steps = body.totalSteps;

    // History handling: replace if a full array is sent, otherwise append entry.
    if (Array.isArray(body.history)) {
      updates.history = body.history;
    } else if (body.historyEntry !== undefined) {
      const { data: existing } = await db
        .from('approval_requests')
        .select('history')
        .eq('id', id)
        .eq('tenant_id', user.tenantId)
        .single();
      const prior = Array.isArray((existing as { history?: unknown[] } | null)?.history)
        ? ((existing as { history: unknown[] }).history)
        : [];
      updates.history = [...prior, body.historyEntry];
    }

    const { data, error } = await db
      .from('approval_requests')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ request: data });
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
      .from('approval_requests')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
