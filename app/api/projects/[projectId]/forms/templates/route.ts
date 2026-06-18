import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('form_templates')
      .select('*')
      .or(`project_id.eq.${params.projectId},is_global.eq.true`)
      .order('name');
    if (error) return NextResponse.json({ templates: [] });
    return NextResponse.json({ templates: data || [] });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // created_by is a uuid column → store the auth user id, not the email.
    // tenant_id must be set explicitly (service-role client; the auto_set_tenant_id
    // trigger can't resolve it without an authenticated user, and the column is NOT NULL).
    const record = {
      ...body,
      project_id: params.projectId,
      tenant_id: user.tenantId,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('form_templates').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
