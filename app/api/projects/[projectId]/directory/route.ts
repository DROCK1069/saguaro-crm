import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('project_id', params.projectId)
      .order('name');
    if (error) {
      // Fallback: try team table
      const { data: team } = await supabase
        .from('project_team')
        .select('*')
        .eq('project_id', params.projectId)
        .order('name');
      return NextResponse.json({ contacts: team || [] });
    }
    return NextResponse.json({ contacts: data || [] });
  } catch {
    return NextResponse.json({ contacts: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // The contacts table has no created_by column; author attribution has no home here.
    // tenant_id must be set explicitly because this route uses the service-role client
    // (the auto_set_tenant_id trigger can't resolve it without an authenticated user).
    const record = {
      ...body,
      project_id: params.projectId,
      tenant_id: user.tenantId,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('contacts').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
