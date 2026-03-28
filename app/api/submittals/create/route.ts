import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.project_id && !body.projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }
    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    const db = createServerClient();
    const { data, error } = await db.from('submittals').insert({
      tenant_id: user.tenantId,
      created_by: user.id,
      project_id: body.project_id || body.projectId,
      title: body.title,
      submittal_number: body.submittal_number || body.submittalNumber || null,
      spec_section: body.spec_section || body.specSection || null,
      description: body.description || null,
      submitted_by: body.submitted_by || body.submittedBy || null,
      submitted_to: body.submitted_to || body.submittedTo || null,
      subcontractor: body.subcontractor || null,
      trade: body.trade || null,
      status: body.status || 'pending',
      priority: body.priority || null,
      due_date: body.due_date || body.dueDate || null,
      notes: body.notes || null,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, submittal: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
