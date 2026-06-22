import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * /api/approval-requests — backs the "Pending Approvals" and "Approval
 * History" tabs of app/app/approval-workflows/page.tsx.
 *
 * approval_requests columns: id, tenant_id, workflow_id, workflow_name,
 * module, item_name, item_amount, requested_by, requested_at, current_step,
 * total_steps, status ('pending'|'approved'|'rejected'), history (jsonb of
 * decision entries), created_at.
 */

// GET /api/approval-requests -> { requests: [...] }
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ requests: [] }, { status: 401 });
  try {
    const db = createServerClient() as unknown as SupabaseClient;
    const { data, error } = await db
      .from('approval_requests')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch {
    return NextResponse.json({ requests: [] });
  }
}

// POST /api/approval-requests -> { request }
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const db = createServerClient() as unknown as SupabaseClient;
    const row: Record<string, unknown> = {
      tenant_id: user.tenantId,
      workflow_id: body.workflow_id ?? body.workflowId ?? null,
      workflow_name: body.workflow_name ?? body.workflowName ?? null,
      module: body.module ?? null,
      item_name: body.item_name ?? body.itemName ?? null,
      item_amount: body.item_amount ?? body.itemAmount ?? null,
      requested_by: body.requested_by ?? body.requestedBy ?? null,
      requested_at: body.requested_at ?? body.requestedAt ?? new Date().toISOString(),
      current_step: body.current_step ?? body.currentStep ?? 1,
      total_steps: body.total_steps ?? body.totalSteps ?? 1,
      status: body.status ?? 'pending',
      history: Array.isArray(body.history) ? body.history : [],
    };
    const { data, error } = await db
      .from('approval_requests')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ request: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
