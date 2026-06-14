import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Single observation.
 *
 * Caller: app/field/observations/page.tsx
 *   updateCAStatus() → PATCH /api/projects/{projectId}/observations/{id}
 *     with { corrective_action: {...}, status }
 *
 * observations real columns: title, description, observation_type, severity,
 * location, photo_urls (jsonb), assigned_to, status, due_date, resolved_at.
 * The field page also sends `corrective_action` (a sub-object) which has no
 * column on this table, so it is dropped to avoid a write error.
 */

const validColumns = new Set([
  'title', 'description', 'observation_type', 'severity', 'location',
  'photo_urls', 'assigned_to', 'status', 'due_date', 'resolved_at',
]);

export async function GET(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('id', params.id)
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .single();
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ observation: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (validColumns.has(k)) updates[k] = v;
    }
    // Auto-stamp resolved_at when an observation is closed/resolved.
    if (
      (updates.status === 'closed' || updates.status === 'resolved') &&
      updates.resolved_at === undefined
    ) {
      updates.resolved_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('observations')
      .update(updates)
      .eq('id', params.id)
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ observation: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from('observations')
      .delete()
      .eq('id', params.id)
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
