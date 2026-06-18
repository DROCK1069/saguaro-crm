import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { Tables } from '@/lib/database.types';

// portal_sub_sessions.sub_id / project_id are nullable in the schema, but a
// usable sub-portal session is always scoped to both (enforced by the guard in
// authenticateSubPortal). Refine those two fields to non-null for callers.
type AuthedSubSession = Omit<
  Tables<'portal_sub_sessions'>,
  'sub_id' | 'project_id'
> & { sub_id: string; project_id: string };

async function authenticateSubPortal(
  req: NextRequest
): Promise<AuthedSubSession | null> {
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-portal-token');
  if (!token) return null;

  const db = createServerClient();
  const { data: session } = await db
    .from('portal_sub_sessions')
    .select('*')
    .eq('token', token)
    .eq('status', 'active')
    .single();

  // sub_id / project_id are nullable on portal_sub_sessions; a usable sub-portal
  // session must be scoped to a specific sub and project. Reject incomplete
  // sessions so callers hit the standard 401 path and downstream .eq() filters
  // never receive a null scope.
  if (!session || !session.sub_id || !session.project_id) return null;

  // Reconstruct with the verified non-null scope so the narrowing carries into
  // the returned type (TS narrows property reads above but not the object itself).
  return { ...session, sub_id: session.sub_id, project_id: session.project_id };
}

/** GET — List tasks/phases assigned to this sub */
export async function GET(req: NextRequest) {
  try {
    const session = await authenticateSubPortal(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      );
    }

    const db = createServerClient();

    const { data: tasks, error } = await db
      .from('portal_sub_tasks')
      .select('*')
      .eq('sub_id', session.sub_id)
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .order('start_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ tasks: tasks || [] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** PATCH — Update task completion or checklist */
export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateSubPortal(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 }
      );
    }

    const db = createServerClient();
    const body = await req.json();
    const { task_id, percent_complete, checklist, status, notes } = body;

    if (!task_id) {
      return NextResponse.json(
        { error: 'task_id is required' },
        { status: 400 }
      );
    }

    // Verify task belongs to this sub
    const { data: existing } = await db
      .from('portal_sub_tasks')
      .select('id')
      .eq('id', task_id)
      .eq('sub_id', session.sub_id)
      .eq('tenant_id', session.tenant_id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Live portal_sub_tasks columns: id, tenant_id, project_id, sub_id, title,
    // description, due_date, status, completed_at, created_at.
    // percent_complete / checklist / notes / updated_at do not exist and there is
    // no jsonb column to fold them into, so only status is persisted. When a task
    // is marked complete, stamp completed_at.
    const updateData: Record<string, any> = {};
    if (status !== undefined) updateData.status = status;
    if (status === 'completed' || status === 'complete') {
      updateData.completed_at = new Date().toISOString();
    }
    if (percent_complete === 100 && updateData.completed_at === undefined) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updated, error } = await db
      .from('portal_sub_tasks')
      .update(updateData)
      .eq('id', task_id)
      .eq('tenant_id', session.tenant_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: updated });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
