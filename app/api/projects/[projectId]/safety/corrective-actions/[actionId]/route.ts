import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; actionId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { status, assigned_to, due_date, verification_date, verified_by } = body;

    // safety_corrective_actions has no verification_date/verified_by columns. The
    // table models resolution via resolved_at + resolution, so verification maps
    // onto those: verification_date -> resolved_at, verifier -> resolution text.
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (due_date !== undefined) updates.due_date = due_date;

    const effVerifDate =
      verification_date !== undefined
        ? verification_date
        : (status === 'verified' ? new Date().toISOString() : undefined);
    const effVerifBy =
      verified_by !== undefined
        ? verified_by
        : (status === 'verified' ? user.email : undefined);
    if (effVerifDate !== undefined) updates.resolved_at = effVerifDate;
    if (effVerifBy !== undefined) updates.resolution = `Verified by ${effVerifBy}`;

    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Try dedicated table first
    const { data, error } = await supabase
      .from('safety_corrective_actions')
      .update(updates)
      .eq('id', params.actionId)
      .eq('project_id', params.projectId)
      .select()
      .single();

    if (error) {
      // Fall back to safety_incidents table
      const fallback = await supabase
        .from('safety_incidents')
        .update(updates)
        .eq('id', params.actionId)
        .eq('project_id', params.projectId)
        .select()
        .single();

      if (fallback.error) {
        return NextResponse.json({ error: `Failed to update: ${fallback.error.message}` }, { status: 500 });
      }

      return NextResponse.json({ action: fallback.data });
    }

    return NextResponse.json({ action: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[safety/corrective-actions/PATCH] error:', msg);
    return NextResponse.json({ error: `Failed to update corrective action: ${msg}` }, { status: 500 });
  }
}
