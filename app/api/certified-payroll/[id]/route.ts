import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Single certified payroll (WH-347) record.
 *
 * Caller: app/app/certified-payroll/page.tsx
 *   GET    /api/certified-payroll/{id}  → fetch one
 *   PUT    /api/certified-payroll/{id}  → persist entries / totals / status / signing
 *   DELETE /api/certified-payroll/{id}  → remove
 *
 * Accepts both snake_case and camelCase body keys.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('certified_payroll')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();
    const updates: Record<string, unknown> = {};

    const pick = (snake: string, camel: string) => {
      if (body[snake] !== undefined) updates[snake] = body[snake];
      else if (body[camel] !== undefined) updates[snake] = body[camel];
    };

    pick('entries', 'entries');
    pick('total_gross', 'totalGross');
    pick('total_deductions', 'totalDeductions');
    pick('total_net', 'totalNet');
    pick('fringe_benefits', 'fringeBenefits');
    pick('status', 'status');
    pick('statement_of_compliance', 'statementOfCompliance');
    pick('signed_by', 'signedBy');
    pick('signed_at', 'signedAt');
    pick('contractor_name', 'contractorName');
    pick('contractor_address', 'contractorAddress');
    pick('project_name', 'projectName');
    pick('project_number', 'projectNumber');
    pick('project_location', 'projectLocation');
    pick('week_ending', 'weekEnding');
    pick('payroll_number', 'payrollNumber');
    pick('wage_decision', 'wageDecision');
    pick('awarding_agency', 'awardingAgency');
    pick('pdf_url', 'pdfUrl');

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data, error } = await db
      .from('certified_payroll')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
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
    const { error } = await db
      .from('certified_payroll')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
