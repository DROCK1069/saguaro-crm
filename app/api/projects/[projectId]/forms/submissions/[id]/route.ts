import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    const ALLOWED_SUBMISSION_COLUMNS = [
      'project_id', 'template_id', 'submitted_by', 'data', 'status', 'reviewed_by', 'reviewed_at',
      'notes', 'responses', 'location',
    ];
    const updates: Record<string, any> = {};
    for (const k of ALLOWED_SUBMISSION_COLUMNS) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const { data, error } = await supabase
      .from('form_submissions')
      .update({ ...updates, reviewed_by: user.email, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('project_id', params.projectId)
      .select()
      .single();
    if (error) return NextResponse.json({ submission: { id: params.id, ...body } });
    return NextResponse.json({ submission: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}
