/**
 * lib/schedule-import.ts — parse external schedule files into a normalized task list.
 *
 * Supports the three text-based interchange formats GCs actually exchange:
 *   • Primavera P6 XER (tab-delimited tables: TASK, TASKPRED, PROJWBS)
 *   • Microsoft Project XML (MSPDI)
 *   • CSV (id,name,duration,predecessors,start)
 *
 * (.mpp is a binary OLE compound file — Procore itself asks users to export
 * to XER/XML, which is exactly what we ingest.)
 */

export type DependType = 'FS' | 'SS' | 'FF' | 'SF';
export interface Predecessor { id: string; type: DependType; lag: number }
export interface ScheduleTask {
  id: string;
  name: string;
  duration: number;            // working days
  predecessors: Predecessor[];
  wbs?: string | null;
  start?: string | null;
  finish?: string | null;
  pct_complete?: number;
}

const DEP_MAP: Record<string, DependType> = { PR_FS: 'FS', PR_SS: 'SS', PR_FF: 'FF', PR_SF: 'SF' };

/** Primavera XER — tab-delimited; %T table, %F fields, %R rows. */
export function parseXER(text: string): ScheduleTask[] {
  const lines = text.split(/\r?\n/);
  let table = '';
  let fields: string[] = [];
  const tasks: Record<string, ScheduleTask> = {};
  const preds: { task: string; pred: string; type: DependType; lag: number }[] = [];

  for (const line of lines) {
    const cells = line.split('\t');
    const tag = cells[0];
    if (tag === '%T') { table = cells[1]; fields = []; continue; }
    if (tag === '%F') { fields = cells.slice(1); continue; }
    if (tag === '%R') {
      const row: Record<string, string> = {};
      fields.forEach((f, i) => { row[f] = cells[i + 1]; });
      if (table === 'TASK') {
        const id = row.task_id;
        tasks[id] = {
          id,
          name: row.task_name || row.task_code || id,
          duration: Math.max(0, Math.round((parseFloat(row.target_drtn_hr_cnt || '0') / 8) || parseFloat(row.remain_drtn_hr_cnt || '0') / 8 || 1)),
          predecessors: [],
          wbs: row.wbs_id || null,
          pct_complete: parseFloat(row.phys_complete_pct || '0') || 0,
        };
      } else if (table === 'TASKPRED') {
        preds.push({
          task: row.task_id,
          pred: row.pred_task_id,
          type: DEP_MAP[row.pred_type] || 'FS',
          lag: Math.round((parseFloat(row.lag_hr_cnt || '0') / 8) || 0),
        });
      }
    }
  }
  for (const p of preds) {
    if (tasks[p.task]) tasks[p.task].predecessors.push({ id: p.pred, type: p.type, lag: p.lag });
  }
  return Object.values(tasks);
}

/** MS Project XML (MSPDI). */
export function parseMSPDI(xml: string): ScheduleTask[] {
  const tasks: ScheduleTask[] = [];
  const taskBlocks = xml.match(/<Task>[\s\S]*?<\/Task>/g) || [];
  const uidToId: Record<string, string> = {};
  const pre: { uid: string; predUid: string; type: DependType; lag: number }[] = [];

  const tag = (block: string, name: string): string | null => {
    const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
    return m ? m[1].trim() : null;
  };

  for (const b of taskBlocks) {
    const uid = tag(b, 'UID') || '';
    const id = tag(b, 'ID') || uid;
    if (!uid) continue;
    uidToId[uid] = id;
    // Duration in MSPDI is ISO8601 like PT40H0M0S → hours/8 = days
    const dur = tag(b, 'Duration') || '';
    const hoursMatch = dur.match(/PT(\d+)H/);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 8;
    tasks.push({
      id,
      name: tag(b, 'Name') || id,
      duration: Math.max(1, Math.round(hours / 8)),
      predecessors: [],
      pct_complete: parseFloat(tag(b, 'PercentComplete') || '0'),
    });
    const linkBlocks = b.match(/<PredecessorLink>[\s\S]*?<\/PredecessorLink>/g) || [];
    for (const lb of linkBlocks) {
      const predUid = tag(lb, 'PredecessorUID') || '';
      const typeNum = tag(lb, 'Type') || '1'; // 0=FF,1=FS,2=SF,3=SS
      const type: DependType = typeNum === '0' ? 'FF' : typeNum === '2' ? 'SF' : typeNum === '3' ? 'SS' : 'FS';
      pre.push({ uid, predUid, type, lag: 0 });
    }
  }
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  for (const p of pre) {
    const t = byId[uidToId[p.uid]];
    if (t && uidToId[p.predUid]) t.predecessors.push({ id: uidToId[p.predUid], type: p.type, lag: p.lag });
  }
  return tasks;
}

/** CSV: id,name,duration,predecessors(semicolon list of "id" or "id:FS+2"),pct */
export function parseScheduleCSV(text: string): ScheduleTask[] {
  const rows = text.split(/\r?\n/).filter((r) => r.trim());
  const header = rows.shift()?.toLowerCase().split(',').map((h) => h.trim()) || [];
  const idx = (k: string) => header.indexOf(k);
  return rows.map((line) => {
    const c = line.split(',');
    const predRaw = (c[idx('predecessors')] || '').trim();
    const predecessors: Predecessor[] = predRaw
      ? predRaw.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
        const m = p.match(/^([^:]+)(?::(FS|SS|FF|SF))?([+-]\d+)?$/i);
        return { id: (m?.[1] || p).trim(), type: (m?.[2]?.toUpperCase() as DependType) || 'FS', lag: parseInt(m?.[3] || '0', 10) };
      })
      : [];
    return {
      id: (c[idx('id')] || '').trim(),
      name: (c[idx('name')] || '').trim(),
      duration: Math.max(0, parseInt(c[idx('duration')] || '1', 10)),
      predecessors,
      pct_complete: parseFloat(c[idx('pct')] || c[idx('pct_complete')] || '0') || 0,
    };
  }).filter((t) => t.id);
}

/** Auto-detect format from content/filename. */
export function parseSchedule(content: string, filename = ''): ScheduleTask[] {
  const f = filename.toLowerCase();
  if (f.endsWith('.xer') || content.startsWith('ERMHDR')) return parseXER(content);
  if (f.endsWith('.xml') || /<Project[\s>]/.test(content)) return parseMSPDI(content);
  return parseScheduleCSV(content);
}
