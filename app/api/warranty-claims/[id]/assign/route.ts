import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST|PATCH /api/warranty-claims/[id]/assign
 * Body: { assigned_to: string, assigned_email?: string, assigned_phone?: string }
 * Sets the assignee. The table only stores assigned_to (text); email/phone are
 * accepted but not persisted. Bumps status Open -> Assigned.
 */
async function assignClaim(req: NextRequest, id: string) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createServerClient();

    // Look up current status to decide whether to bump Open -> Assigned.
    const { data: existing } = await supabase
      .from('warranty_claims')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    const update: Record<string, unknown> = {
      assigned_to: body.assigned_to || null,
      updated_at: new Date().toISOString(),
    };
    if (existing && (existing as { status?: string }).status === 'Open') {
      update.status = 'Assigned';
    }

    const { data, error } = await supabase
      .from('warranty_claims')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ claim: data, ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to assign claim' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return assignClaim(req, params.id);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return assignClaim(req, params.id);
}
