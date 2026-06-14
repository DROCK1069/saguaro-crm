import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const db = createServerClient();
    const ALLOWED_SUBMISSION_COLUMNS = [
      'invite_id', 'sub_id', 'template_id', 'answers', 'documents', 'score', 'status',
      'reviewed_by', 'reviewed_at', 'notes', 'updated_at',
    ];
    const updates: Record<string, any> = {};
    for (const k of ALLOWED_SUBMISSION_COLUMNS) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const { data, error } = await db
      .from('prequalification_submissions')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
