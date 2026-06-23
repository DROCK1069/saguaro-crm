import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data, error } = await db.from('correspondence').select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = createServerClient() as any;

  const record: any = {
    project_id: projectId,
    tenant_id: user.tenantId,
    subject: body.subject ?? null,
    body: body.body ?? null,
    correspondence_type: body.correspondence_type ?? body.type ?? null,
    to_names: body.to_names ?? body.to ?? [],
    cc_names: body.cc_names ?? body.cc ?? [],
    from_email: user.email,
    from_name: body.from_name ?? null,
    priority: body.priority || 'Normal',
    direction: body.direction || 'outbound',
    reference_number: body.reference_number ?? null,
    ...(body.sent_at ? { sent_at: body.sent_at } : {}),
    created_by: user.id,
    status: body.status || 'draft',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await db.from('correspondence').insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
