import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

/**
 * Client accept/decline for a proposal. This route ONLY flips the proposal's status
 * (and stamps accepted_at / declined_at); recording the win/loss + firing the learner
 * is a SEPARATE call the client makes to POST /api/bids/outcome.
 *
 * Body: { status: 'accepted' | 'declined' }
 * Service-role client bypasses RLS → the update is explicitly tenant-scoped.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const { id } = await params;
  const { user } = g;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = g.db as any;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const status =
    body.status === 'accepted' ? 'accepted' : body.status === 'declined' ? 'declined' : null;
  if (!status) {
    return NextResponse.json({ error: 'status must be "accepted" or "declined".' }, { status: 400 });
  }

  // accepted_at and declined_at both exist on public.proposals (verified against schema).
  const patch: Record<string, unknown> = { status };
  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  else patch.declined_at = new Date().toISOString();

  try {
    const { data, error } = await db
      .from('proposals')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
