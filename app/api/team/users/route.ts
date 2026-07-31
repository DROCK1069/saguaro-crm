import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team/users
 * Returns the tenant's REAL users from `profiles` (tenant-scoped).
 * Consumed by the Roles & Permissions admin page (Users tab + Assign / Invite
 * modals) so every person it targets is an actual member of the tenant.
 *
 * Response shape: { users: [{ id, name, email, role, title, avatarUrl }] }
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, email, role, title, avatar_url')
      .eq('tenant_id', user.tenantId)
      .order('full_name', { ascending: true });
    if (error) throw error;

    const users = (data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email ?? 'Unknown',
      email: p.email ?? '',
      role: p.role ?? null,
      title: p.title ?? null,
      avatarUrl: p.avatar_url ?? null,
    }));

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
