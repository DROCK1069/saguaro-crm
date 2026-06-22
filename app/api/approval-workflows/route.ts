import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * /api/approval-workflows — backs the "Workflow Templates" tab of
 * app/app/approval-workflows/page.tsx.
 *
 * approval_workflows columns: id, tenant_id, name, module, steps (jsonb),
 * active, created_at, updated_at. The page maps `active` <-> `enabled` and
 * stores the step builder array in `steps`.
 *
 * The table is not in database.types, so the typed client is widened to an
 * untyped SupabaseClient for these queries.
 */

// GET /api/approval-workflows -> { workflows: [...] }
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ workflows: [] }, { status: 401 });
  try {
    const db = createServerClient() as unknown as SupabaseClient;
    const { data, error } = await db
      .from('approval_workflows')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ workflows: data ?? [] });
  } catch {
    return NextResponse.json({ workflows: [] });
  }
}

// POST /api/approval-workflows -> { workflow }
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const db = createServerClient() as unknown as SupabaseClient;
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      tenant_id: user.tenantId,
      name: body.name ?? 'Untitled Workflow',
      module: body.module ?? null,
      steps: Array.isArray(body.steps) ? body.steps : [],
      active: body.active ?? true,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await db
      .from('approval_workflows')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ workflow: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
