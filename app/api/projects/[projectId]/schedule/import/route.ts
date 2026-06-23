import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { parseSchedule } from '@/lib/schedule-import';
import { parseMPP, isMPP } from '@/lib/mpp-import';
import { computeCPM } from '@/lib/cpm';

export const runtime = 'nodejs';
export const maxDuration = 120;
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/projects/[projectId]/schedule/import
 * Body: { content: string, filename?: string }
 * Parses a Primavera XER / MS Project XML / CSV schedule, runs CPM, and
 * upserts the tasks with early/late dates, float, and critical-path flags.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  // .mpp binary: client sends base64; text formats send raw string
  let parsed;
  if (body.binary) {
    const buf = Buffer.from(body.content, 'base64');
    if (!isMPP(buf)) return NextResponse.json({ error: 'Not a valid .mpp file' }, { status: 422 });
    parsed = await parseMPP(buf);
  } else {
    parsed = parseSchedule(String(body.content), body.filename || '');
  }
  if (!parsed.length) return NextResponse.json({ error: 'No tasks found in file' }, { status: 422 });

  const cpm = computeCPM(parsed);
  const byId = new Map(cpm.tasks.map((t) => [t.id, t]));
  const db = createServerClient() as any;

  // Map external task ids -> our rows. Anchor a start date so es/ef become real dates.
  const start = body.start_date ? new Date(body.start_date) : new Date();
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + Math.round(n)); return x.toISOString().slice(0, 10); };

  const rows = parsed.map((t) => {
    const c = byId.get(t.id)!;
    return {
      tenant_id: user.tenantId,
      project_id: projectId,
      external_id: t.id,
      name: t.name,
      duration: t.duration,
      predecessors: t.predecessors,
      start_date: addDays(start, c.es),
      end_date: addDays(start, c.ef),
      es: c.es, ef: c.ef, ls: c.ls, lf: c.lf,
      total_float: c.total_float,
      is_critical: c.critical,
      pct_complete: t.pct_complete || 0,
      wbs: t.wbs || null,
      status: 'not_started',
    };
  });

  // Replace any prior imported tasks for this project, then insert fresh.
  await db.from('schedule_tasks').delete().eq('project_id', projectId).eq('tenant_id', user.tenantId).not('external_id', 'is', null);
  const { data, error } = await db.from('schedule_tasks').insert(rows).select('id, external_id, is_critical');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported: data?.length || 0,
    project_duration_days: cpm.project_duration,
    critical_path_length: cpm.critical_path.length,
    has_cycle: cpm.has_cycle,
    finish_date: addDays(start, cpm.project_duration),
  });
}
