import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();
    // Map inbound API keys to real `drawings` columns
    // (sheet_number<-drawing_number, name<-title, version<-revision).
    const fieldMap: Record<string, string> = {
      drawing_number: 'sheet_number',
      title: 'name',
      discipline: 'discipline',
      revision: 'version',
      revision_date: 'revision_date',
      status: 'status',
      url: 'url',
      notes: 'notes',
    };
    const fields: Record<string, any> = {};
    for (const k of Object.keys(fieldMap)) { if (body[k] !== undefined) fields[fieldMap[k]] = body[k]; }
    const { error } = await db.from('drawings').update(fields).eq('id', id).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { error } = await db.from('drawings').delete().eq('id', id).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
