import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

/**
 * Cross-project resource planning (staffing assignments).
 * Backs /app/resource-planning page.
 *
 * The page works in its own "Assignment" shape; the DB table `resource_assignments`
 * uses different column names. These helpers map between the two so the page contract
 * is preserved while only writing real columns.
 *
 *   page.person_name  <-> db.resource_name
 *   page.hourly_rate  <-> db.cost_rate
 *   page.trade        -> stored in resource_type (no dedicated trade column)
 *   page.days_per_week / certifications -> not persisted (no columns); echoed safe defaults
 */

type DbRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  resource_type: string | null;
  resource_name: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  hours_per_day: number | null;
  cost_rate: number | null;
  status: string | null;
  notes: string | null;
};

function toPage(r: DbRow) {
  return {
    id: r.id,
    person_name: r.resource_name || '',
    person_id: r.id,
    role: r.role || 'Laborer',
    trade: r.resource_type || 'General',
    certifications: [] as string[],
    start_date: r.start_date || '',
    end_date: r.end_date || '',
    hours_per_day: Number(r.hours_per_day ?? 8),
    days_per_week: 5,
    hourly_rate: Number(r.cost_rate ?? 0),
    status: (r.status as string) || 'assigned',
    notes: r.notes || '',
    project_id: r.project_id || '',
  };
}

type ResourceAssignmentInsert = TablesInsert<'resource_assignments'>;

export function toDb(body: Record<string, unknown>, tenantId: string) {
  const row: Partial<ResourceAssignmentInsert> = {};
  if (body.person_name !== undefined) row.resource_name = body.person_name as string;
  if (body.resource_name !== undefined) row.resource_name = body.resource_name as string;
  if (body.role !== undefined) row.role = body.role as string;
  if (body.trade !== undefined) row.resource_type = body.trade as string;
  if (body.resource_type !== undefined) row.resource_type = body.resource_type as string;
  if (body.start_date !== undefined) row.start_date = (body.start_date as string) || null;
  if (body.end_date !== undefined) row.end_date = (body.end_date as string) || null;
  if (body.hours_per_day !== undefined) row.hours_per_day = body.hours_per_day as number;
  if (body.hourly_rate !== undefined) row.cost_rate = body.hourly_rate as number;
  if (body.cost_rate !== undefined) row.cost_rate = body.cost_rate as number;
  if (body.status !== undefined) row.status = body.status as string;
  if (body.notes !== undefined) row.notes = body.notes as string;
  if (body.project_id) row.project_id = body.project_id as string;
  row.tenant_id = tenantId;
  if (row.resource_type === undefined) row.resource_type = 'labor';
  return row;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ data: [], source: 'unauth' }, { status: 401 });

    const db = createServerClient();
    const { data, error } = await db
      .from('resource_assignments')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('start_date', { ascending: true });
    if (error) throw error;

    const mapped = (data || []).map((r) => toPage(r as DbRow));
    return NextResponse.json({ data: mapped, source: 'live' });
  } catch {
    return NextResponse.json({ data: [], source: 'error' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const row = toDb(body, user.tenantId);

    const db = createServerClient();
    const { data, error } = await db
      .from('resource_assignments')
      .insert(row as ResourceAssignmentInsert)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ data: toPage(data as DbRow) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
