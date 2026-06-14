import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

/**
 * PATCH /api/roles/assignments/[id]
 * Update a user role assignment (e.g. change role or project scope).
 * Only FK columns that exist on user_role_assignments are persisted.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();

    const fields: Record<string, unknown> = {};
    const roleId = body.roleId ?? body.role_id;
    const userId = body.userId ?? body.user_id;
    if (roleId !== undefined) fields.role_id = roleId;
    if (userId !== undefined) fields.user_id = userId;
    if (body.projectId !== undefined) fields.project_id = body.projectId || null;
    else if (body.project_id !== undefined) fields.project_id = body.project_id || null;

    const { data, error } = await db
      .from('user_role_assignments')
      .update(fields)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, assignment: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/roles/assignments/[id]
 * Remove a user role assignment.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { error } = await db
      .from('user_role_assignments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
