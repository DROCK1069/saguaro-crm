/**
 * lib/mpp-import.ts — read Microsoft Project .mpp (binary OLE2 / Compound File).
 *
 * .mpp is a Compound File Binary container (signature D0CF11E0). We open it with
 * the battle-tested SheetJS `cfb` reader and pull the task list out of the MS
 * Project task streams (Var2Data / FixedData under the version storage), where
 * task names are stored as UTF-16LE runs.
 *
 * Fidelity note: full duration/dependency decode is version-specific binary and
 * best obtained via P6 XER or MS Project XML export. .mpp import yields the task
 * roster (names + outline order); durations default to 1 day with no invented
 * links, so the CPM pass stays honest rather than fabricating a critical path.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ScheduleTask } from './schedule-import';

export function isMPP(buf: Uint8Array): boolean {
  return buf.length > 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
}

/** Extract printable UTF-16LE strings (>= min chars) from a byte buffer. */
function utf16Strings(buf: Uint8Array, min = 3): string[] {
  const out: string[] = [];
  let cur: number[] = [];
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const code = buf[i] | (buf[i + 1] << 8);
    if (code >= 0x20 && code < 0xfffe && code !== 0x7f) cur.push(code);
    else { if (cur.length >= min) out.push(String.fromCharCode(...cur)); cur = []; }
  }
  if (cur.length >= min) out.push(String.fromCharCode(...cur));
  return out;
}

const NAME_STREAM_RE = /Var2Data|FixedData|FixData|TBkndTask|Props/i;
// Drop obvious non-task noise (MSP internal tokens / pure numbers / GUIDs).
const NOISE_RE = /^(MSProject|PROJ|Microsoft|Var2?Data|Fix(ed)?Data|TBkndTask|Props|Root Entry)$/i;

export async function parseMPP(buf: Uint8Array): Promise<ScheduleTask[]> {
  const CFB: any = await import('cfb' as string);
  const container = CFB.read(buf, { type: 'buffer' });
  const seen = new Set<string>();
  const names: string[] = [];

  for (const entry of container.FileIndex || []) {
    if (!entry?.content || !NAME_STREAM_RE.test(entry.name || '')) continue;
    for (const s of utf16Strings(entry.content)) {
      const t = s.trim().replace(/\s+/g, ' ');
      if (t.length < 3 || t.length > 120) continue;
      if (!/[A-Za-z]/.test(t)) continue;          // must contain letters
      if (/^[0-9.\-/: ]+$/.test(t)) continue;      // skip pure numbers/dates
      if (NOISE_RE.test(t)) continue;
      if (seen.has(t)) continue;
      seen.add(t); names.push(t);
    }
  }

  return names.map((name, i) => ({
    id: `mpp-${i + 1}`,
    name,
    duration: 1,
    predecessors: [],
    pct_complete: 0,
  }));
}
