import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { computeCPM } from '@/lib/cpm';
import type { ScheduleTask } from '@/lib/schedule-import';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/projects/[projectId]/schedule/cpm
 * Recomputes the critical path live from stored schedule_tasks.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data, error } = await db.from('schedule_tasks').select('*')
    .eq('project_id', projectId).eq('tenant_id', user.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tasks: ScheduleTask[] = (data || []).map((r: any) => ({
    id: r.external_id || r.id,
    name: r.name,
    duration: r.duration || 1,
    predecessors: Array.isArray(r.predecessors) ? r.predecessors : [],
    pct_complete: r.pct_complete || 0,
  }));
  if (!tasks.length) return NextResponse.json({ tasks: [], project_duration: 0, critical_path: [] });

  const cpm = computeCPM(tasks);
  return NextResponse.json(cpm);
}
