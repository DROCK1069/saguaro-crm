import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Certified payroll (WH-347) records.
 *
 * Caller: app/app/certified-payroll/page.tsx
 *   loadPeriods()    → GET  /api/certified-payroll?projectId={id}
 *   handleCreate()   → POST /api/certified-payroll { project_id, week_ending, ... }
 *
 * certified_payroll real columns: id, tenant_id, project_id, week_ending,
 * payroll_number, contractor_name, contractor_address, project_name,
 * project_number, project_location, entries (jsonb, worker rows), total_gross,
 * total_deductions, total_net, fringe_benefits (jsonb), statement_of_compliance,
 * signed_by, signed_at, pdf_url, status, wage_decision, awarding_agency,
 * created_at, updated_at.
 *
 * The `entries` jsonb stores the page's WorkerEntry[] shape verbatim so the
 * round-trip is lossless.
 */

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const projectId = req.nextUrl.searchParams.get('projectId');
    let query = db
      .from('certified_payroll')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('week_ending', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ records: data ?? [] });
  } catch {
    return NextResponse.json({ records: [] });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const projectId = body.project_id ?? body.projectId;
    const weekEnding = body.week_ending ?? body.weekEnding;
    if (!projectId || !weekEnding) {
      return NextResponse.json({ error: 'project_id and week_ending are required' }, { status: 400 });
    }
    const db = createServerClient();
    const { data, error } = await db
      .from('certified_payroll')
      .insert({
        tenant_id: user.tenantId,
        project_id: projectId,
        week_ending: weekEnding,
        payroll_number: body.payroll_number ?? body.payrollNumber ?? null,
        contractor_name: body.contractor_name ?? body.contractorName ?? null,
        contractor_address: body.contractor_address ?? body.contractorAddress ?? null,
        project_name: body.project_name ?? body.projectName ?? null,
        project_number: body.project_number ?? body.projectNumber ?? null,
        project_location: body.project_location ?? body.projectLocation ?? null,
        wage_decision: body.wage_decision ?? body.wageDecision ?? null,
        awarding_agency: body.awarding_agency ?? body.awardingAgency ?? null,
        entries: body.entries ?? [],
        total_gross: body.total_gross ?? 0,
        total_deductions: body.total_deductions ?? 0,
        total_net: body.total_net ?? 0,
        fringe_benefits: body.fringe_benefits ?? body.fringeBenefits ?? [],
        statement_of_compliance: body.statement_of_compliance ?? false,
        status: body.status ?? 'draft',
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
