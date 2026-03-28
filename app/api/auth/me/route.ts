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
