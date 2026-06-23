import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { applyApproval, computeGrossPay, type TimesheetStatus, type ApprovalAction } from '@/lib/timesheet-rules';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/projects/[projectId]/timesheets/[id]/approve
 * Body: { action: 'submit'|'foreman_approve'|'pm_approve'|'reject'|'reopen', reason? }
 * Drives the multi-level approval state machine and, on PM approval, locks in
 * gross pay from the worker's union rate class.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as ApprovalAction;
  const db = createServerClient() as any;

  const { data: ts } = await db.from('timesheets').select('*')
    .eq('id', id).eq('project_id', projectId).eq('tenant_id', user.tenantId).single();
  if (!ts) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });

  const result = applyApproval((ts.status || 'draft') as TimesheetStatus, action);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  const now = new Date().toISOString();
  const updates: any = { status: result.next, updated_at: now };
  if (action === 'submit') updates.submitted_at = now;
  if (action === 'foreman_approve') { updates.foreman_approved_by = user.id; updates.foreman_approved_at = now; }
  if (action === 'reject') updates.rejection_reason = body.reason || 'Rejected';
  if (result.next === 'approved') {
    updates.approved_by = user.id; updates.approved_at = now;
    // lock in gross pay from rate class
    if (ts.rate_class) {
      const { data: rate } = await db.from('union_rate_classes').select('*')
        .eq('tenant_id', user.tenantId).eq('classification', ts.rate_class)
        .or(`project_id.eq.${projectId},project_id.is.null`).limit(1).maybeSingle();
      if (rate) {
        const pay = computeGrossPay(
          { regular: Number(ts.hours_regular) || 0, overtime: Number(ts.hours_overtime) || 0, doubletime: Number(ts.hours_doubletime) || Number(ts.hours_double) || 0, total: Number(ts.hours) || 0 },
          { classification: rate.classification, base_rate: Number(rate.base_rate), fringe_rate: Number(rate.fringe_rate) },
        );
        updates.gross_pay = pay.gross;
      }
    }
  }

  const { data, error } = await db.from('timesheets').update(updates).eq('id', id).eq('tenant_id', user.tenantId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ timesheet: data, transition: `${ts.status || 'draft'} → ${result.next}` });
}
