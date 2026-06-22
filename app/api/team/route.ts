import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team
 * Returns the tenant's user directory (profiles) for user pickers — e.g. the
 * role-assignment dropdown on the roles-permissions admin page. The `id` here
 * is the auth user id (profiles.id), which matches the user_id stored on
 * user_role_assignments, so assignments resolve back to these users.
 *
 * Response shape: { members: [{ id, name, email, role }] }
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ members: [] }, { status: 401 });

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('tenant_id', user.tenantId)
      .order('full_name', { ascending: true });

    if (error) throw error;

    const members = (data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email ?? 'Unknown',
      email: p.email ?? '',
      role: p.role ?? null,
    }));

    return NextResponse.json({ members });
  } catch {
    return NextResponse.json({ members: [] });
  }
}
