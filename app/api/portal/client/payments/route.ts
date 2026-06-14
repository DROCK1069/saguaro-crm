import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getPortalSession, PORTAL_PERMS } from '@/lib/portal-auth';

/** GET — list payment history */
export async function GET(req: NextRequest) {
  try {
    const session = await getPortalSession(req, PORTAL_PERMS.VIEW_FINANCIALS);
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const db = createServerClient();
    const { data: payments, error } = await db
      .from('portal_payments')
      .select('*')
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate totals
    const all = payments || [];
    const summary = {
      total_paid: all
        .filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      total_pending: all
        .filter((p: any) => p.status === 'pending')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      total_count: all.length,
    };

    return NextResponse.json({ payments: all, summary });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST — initiate a payment */
export async function POST(req: NextRequest) {
  try {
    const session = await getPortalSession(req, PORTAL_PERMS.VIEW_FINANCIALS);
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { amount, payment_method, invoice_id, description } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 });
    }

    const db = createServerClient();

    // Live portal_payments columns: tenant_id, project_id, session_id, amount,
    // payment_type, status, due_date, paid_at, invoice_url, notes, created_at.
    // payment_method -> payment_type, description -> notes. There is no
    // invoice_id / initiated_by column: invoice_id is folded into notes and the
    // initiator is recorded via session_id.
    const combinedNotes = [
      description || null,
      invoice_id ? `Invoice: ${invoice_id}` : null,
    ].filter(Boolean).join(' — ');

    const { data: payment, error } = await db
      .from('portal_payments')
      .insert({
        project_id: session.project_id,
        tenant_id: session.tenant_id,
        session_id: session.id,
        amount,
        payment_type: payment_method || null,
        notes: combinedNotes || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
