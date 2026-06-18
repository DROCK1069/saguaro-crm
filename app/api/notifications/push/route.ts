import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const asString = (v: unknown): string | null =>
    typeof v === 'string' ? v : v == null ? null : String(v);

  const row = {
    tenant_id: user.tenantId,
    project_id: asString(body.project_id ?? body.projectId) || null,
    title: asString(body.title) || '',
    body: asString(body.body ?? body.message) || '',
    type: asString(body.type) || 'general',
    link: asString(body.url) || null,
    is_read: false,
  };

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('notifications')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, notification: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[notifications/push] error:', msg);
    return NextResponse.json(
      { error: `[notifications/push] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
