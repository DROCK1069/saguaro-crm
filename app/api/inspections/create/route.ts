import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  try {
    const supabase = createServerClient();

    // Mobile sends { results: [{ result: 'pass' | 'fail', ... }], score }.
    // Derive the persisted outcome columns from results when present.
    const results = Array.isArray(body.results) ? (body.results as Array<Record<string, unknown>>) : null;
    const checklistTotal  = results ? results.length : (body.checklist_total  || 0);
    const checklistPassed = results ? results.filter((r) => r?.result === 'pass').length : (body.checklist_passed || 0);
    const deficiencyCount = results ? results.filter((r) => r?.result === 'fail').length : (body.deficiency_count || 0);

    // Accept both camelCase and snake_case from the body for every field.
    const inspectionType =
      body.inspection_type ?? body.inspectionType ?? body.type ?? body.template_name ?? 'Other';
    const inspectorName    = body.inspector_name    ?? body.inspectorName    ?? null;
    const inspectorAgency  = body.inspector_agency  ?? body.inspectorAgency  ?? body.agency ?? body.agencyName ?? null;
    const agency           = body.agency            ?? body.agencyName       ?? inspectorAgency ?? null;
    const ahjName          = body.ahj_name          ?? body.ahjName          ?? null;
    const permitNumber     = body.permit_number     ?? body.permitNumber     ?? null;
    const scheduledDate    = body.scheduled_date    ?? body.scheduledDate     ?? new Date().toISOString().split('T')[0];
    const result           = body.result            ?? 'pending';
    const notes            = body.notes             ?? null;
    const weather          = body.weather           ?? null;

    const row = {
      project_id:        body.project_id ?? body.projectId,
      tenant_id:         user.tenantId,
      inspection_type:   inspectionType,
      result:            result || 'pending',
      inspector_name:    inspectorName,
      inspector_agency:  inspectorAgency,
      agency:            agency,
      ahj_name:          ahjName,
      permit_number:     permitNumber,
      scheduled_date:    scheduledDate,
      notes:             notes,
      weather:           weather,
      checklist:         body.checklist         || '[]',
      checklist_total:   checklistTotal,
      checklist_passed:  checklistPassed,
      deficiency_count:  deficiencyCount,
      items:             body.results           || body.checklist || '[]',
      status:            'Scheduled',
    };

    const { data, error } = await supabase
      .from('inspections')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, inspection: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[inspections/create] error:', msg);
    return NextResponse.json(
      { error: `[inspections/create] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
