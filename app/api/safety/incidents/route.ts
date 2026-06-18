import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

// GET /api/safety/incidents?projectId=  -> { incidents: [...] }
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ incidents: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || searchParams.get('project_id');
  try {
    const db = createServerClient();
    let q = db.from('safety_incidents').select('*').eq('tenant_id', user.tenantId).order('incident_date', { ascending: false });
    if (projectId) q = q.eq('project_id', projectId);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ incidents: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, incidents: [] }, { status: 500 });
  }
}

// POST /api/safety/incidents  -> report an incident
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const db = createServerClient();
    const ALLOWED_INCIDENT_COLUMNS = [
      'project_id', 'description', 'severity', 'injury_type', 'location', 'reported_to',
      'incident_date', 'reported_by', 'status', 'time_of_incident', 'weather_conditions', 'witnesses',
      'root_cause', 'corrective_actions', 'preventive_measures', 'photos', 'supervisor_name', 'gps_lat',
      'gps_lng', 'created_by', 'osha_reportable', 'injury_description', 'body_part', 'treatment_type',
      'hospital_name', 'work_restrictions', 'days_away', 'incident_type', 'near_miss', 'osha_recordable',
      'type', 'injury_nature', 'days_restricted', 'employee_name', 'employee_id', 'reported_to_osha',
      'osha_case_number', 'first_aid_only', 'medical_treatment', 'injured_party', 'witness_names',
      'immediate_actions', 'reviewed_by', 'reviewed_at',
    ];
    const insertRow: Record<string, unknown> = {};
    for (const k of ALLOWED_INCIDENT_COLUMNS) {
      if ((body as Record<string, unknown>)[k] !== undefined) insertRow[k] = (body as Record<string, unknown>)[k];
    }
    const { data, error } = await db
      .from('safety_incidents')
      .insert({ ...insertRow, tenant_id: user.tenantId } as TablesInsert<'safety_incidents'>)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, incident: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
