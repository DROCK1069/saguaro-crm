/**
 * lib/cpm.ts — Critical Path Method scheduler.
 *
 * Forward + backward pass over a task network to compute Early/Late Start &
 * Finish, total float, the critical path, and project duration. Supports
 * FS/SS/FF/SF dependencies with lag. This is the engine Procore's schedule
 * tool runs to flag the critical path.
 */
import type { ScheduleTask, DependType } from './schedule-import';

export interface CpmTask {
  id: string;
  name: string;
  duration: number;
  es: number; ef: number; ls: number; lf: number;
  total_float: number;
  critical: boolean;
  predecessors: { id: string; type: DependType; lag: number }[];
}
export interface CpmResult {
  tasks: CpmTask[];
  project_duration: number;
  critical_path: string[];
  has_cycle: boolean;
}

export function computeCPM(input: ScheduleTask[]): CpmResult {
  const byId = new Map(input.map((t) => [t.id, t]));
  // keep only resolvable predecessors
  const tasks = input.map((t) => ({
    ...t,
    predecessors: t.predecessors.filter((p) => byId.has(p.id)),
  }));
  const map = new Map(tasks.map((t) => [t.id, t]));

  // Topological order (Kahn). Edge pred -> task.
  const indeg = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  const succ = new Map<string, string[]>(tasks.map((t) => [t.id, []]));
  for (const t of tasks) {
    for (const p of t.predecessors) {
      indeg.set(t.id, (indeg.get(t.id) || 0) + 1);
      succ.get(p.id)!.push(t.id);
    }
  }
  const queue = tasks.filter((t) => (indeg.get(t.id) || 0) === 0).map((t) => t.id);
  const order: string[] = [];
  const indegWork = new Map(indeg);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succ.get(id) || []) {
      indegWork.set(s, (indegWork.get(s) || 0) - 1);
      if ((indegWork.get(s) || 0) === 0) queue.push(s);
    }
  }
  const has_cycle = order.length !== tasks.length;
  // if cycle, fall back to input order for remaining so we still produce output
  if (has_cycle) for (const t of tasks) if (!order.includes(t.id)) order.push(t.id);

  const es = new Map<string, number>(), ef = new Map<string, number>();
  const ls = new Map<string, number>(), lf = new Map<string, number>();

  // Forward pass
  for (const id of order) {
    const t = map.get(id)!;
    let start = 0;
    for (const p of t.predecessors) {
      const pe = ef.get(p.id) ?? 0, ps = es.get(p.id) ?? 0;
      let candidate = 0;
      if (p.type === 'FS') candidate = pe + p.lag;
      else if (p.type === 'SS') candidate = ps + p.lag;
      else if (p.type === 'FF') candidate = pe + p.lag - t.duration;
      else candidate = ps + p.lag - t.duration; // SF
      start = Math.max(start, candidate);
    }
    es.set(id, Math.max(0, start));
    ef.set(id, Math.max(0, start) + t.duration);
  }

  const projectDuration = Math.max(0, ...tasks.map((t) => ef.get(t.id) || 0));

  // Backward pass
  for (const id of [...order].reverse()) {
    const t = map.get(id)!;
    const successors = succ.get(id) || [];
    let finish = successors.length ? Infinity : projectDuration;
    for (const sId of successors) {
      const s = map.get(sId)!;
      const link = s.predecessors.find((p) => p.id === id)!;
      const sls = ls.get(sId) ?? projectDuration, slf = lf.get(sId) ?? projectDuration;
      let candidate = projectDuration;
      if (link.type === 'FS') candidate = sls - link.lag;
      else if (link.type === 'SS') candidate = sls - link.lag + t.duration;
      else if (link.type === 'FF') candidate = slf - link.lag;
      else candidate = slf - link.lag + t.duration; // SF
      finish = Math.min(finish, candidate);
    }
    if (!isFinite(finish)) finish = projectDuration;
    lf.set(id, finish);
    ls.set(id, finish - t.duration);
  }

  const out: CpmTask[] = tasks.map((t) => {
    const tf = (ls.get(t.id) ?? 0) - (es.get(t.id) ?? 0);
    return {
      id: t.id, name: t.name, duration: t.duration,
      es: es.get(t.id) ?? 0, ef: ef.get(t.id) ?? 0,
      ls: ls.get(t.id) ?? 0, lf: lf.get(t.id) ?? 0,
      total_float: Math.round(tf),
      critical: Math.round(tf) <= 0,
      predecessors: t.predecessors,
    };
  });

  const critical_path = out.filter((t) => t.critical).sort((a, b) => a.es - b.es).map((t) => t.id);
  return { tasks: out, project_duration: projectDuration, critical_path, has_cycle };
}
