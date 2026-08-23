import { NextRequest, NextResponse } from 'next/server';
import { getUser, createServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, phone, role, title, company, avatar_url, tenant_id')
    .eq('id', user.id)
    .single();

  const p = profile as any;
  const name = p?.full_name || user.email.split('@')[0];

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name,
    tenantId: user.tenantId,
    phone: p?.phone || null,
    role: p?.role || 'member',
    title: p?.title || null,
    company: p?.company || null,
    avatarUrl: p?.avatar_url || null,
  });
}

/** PUT /api/auth/me — update the signed-in user's own profile
 *  (full_name / phone / title). Only the provided fields change. */
export async function PUT(req: NextRequest) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, string | null> = {};

  if (typeof body.full_name === 'string') {
    const v = body.full_name.trim().slice(0, 120);
    if (!v) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    patch.full_name = v;
  }
  if (typeof body.phone === 'string') patch.phone = body.phone.trim().slice(0, 40) || null;
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 80) || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const db = createServerClient();
  const { error } = await db.from('profiles').update(patch).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
