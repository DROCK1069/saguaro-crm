import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const ALLOWED_INCIDENT_COLUMNS = [
      'tenant_id', 'project_id', 'description', 'severity', 'injury_type', 'location', 'reported_to',
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
      if (body[k] !== undefined) insertRow[k] = body[k];
    }
    const { data, error } = await supabase.from('safety_incidents').insert(insertRow).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, incident: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[safety/incidents/create] error:', msg);
    return NextResponse.json({ error: `Failed to create safety incident: ${msg}` }, { status: 500 });
  }
}
