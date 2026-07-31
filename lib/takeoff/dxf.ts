/**
 * Minimal deterministic DXF (AutoCAD ASCII) parser — turns a CAD drawing into exact
 * geometry for zero-tap quantities (walls/areas/counts) with no tracing. Pure JS, no
 * vendor. Handles the entities a takeoff cares about: LINE, LWPOLYLINE, POLYLINE(+VERTEX),
 * CIRCLE, ARC. DXF is a stream of (groupCode, value) pairs, two lines each.
 *
 * Coordinates come back in the drawing's own units; `insUnits` ($INSUNITS) hints the unit
 * (1=in, 2=ft, 4=mm, 5=cm, 6=m) so the caller can convert to feet.
 */

export interface DxfLine { x1: number; y1: number; x2: number; y2: number }
export interface DxfPolyline { pts: { x: number; y: number }[]; closed: boolean }
export interface DxfCircle { cx: number; cy: number; r: number }
export interface DxfArc { cx: number; cy: number; r: number; startDeg: number; endDeg: number }

export interface DxfResult {
  ok: boolean;
  error?: string;
  lines: DxfLine[];
  polylines: DxfPolyline[];
  circles: DxfCircle[];
  arcs: DxfArc[];
  insUnits: number | null;
}

/** ft-per-unit for a $INSUNITS code (null → assume already feet). */
export function insUnitsToFeet(insUnits: number | null): number {
  switch (insUnits) {
    case 1: return 1 / 12;      // inches
    case 2: return 1;           // feet
    case 4: return 1 / 304.8;   // mm
    case 5: return 1 / 30.48;   // cm
    case 6: return 3.28084;     // meters
    default: return 1;
  }
}

interface Pair { code: number; val: string }

function tokenize(text: string): Pair[] {
  const raw = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const code = parseInt(raw[i].trim(), 10);
    if (Number.isNaN(code)) { i -= 1; continue; } // resync on a stray line
    pairs.push({ code, val: raw[i + 1] });
  }
  return pairs;
}

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

export function parseDxf(text: string): DxfResult {
  const out: DxfResult = { ok: false, lines: [], polylines: [], circles: [], arcs: [], insUnits: null };
  if (!text || typeof text !== 'string') { out.error = 'Empty DXF'; return out; }
  const pairs = tokenize(text);
  if (!pairs.length) { out.error = 'Not a DXF (no code/value pairs)'; return out; }

  // $INSUNITS (HEADER): a `9 $INSUNITS` pair followed by a `70 <n>` pair.
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i].code === 9 && pairs[i].val.trim() === '$INSUNITS' && pairs[i + 1].code === 70) {
      out.insUnits = parseInt(pairs[i + 1].val.trim(), 10) || 0;
      break;
    }
  }

  // Walk entities: a code-0 pair starts a new entity whose name is the value.
  let i = 0;
  const n = pairs.length;
  while (i < n) {
    if (pairs[i].code !== 0) { i++; continue; }
    const type = pairs[i].val.trim();
    i++;
    // collect this entity's pairs until the next code-0
    const body: Pair[] = [];
    while (i < n && pairs[i].code !== 0) { body.push(pairs[i]); i++; }
    const first = (code: number) => body.find((p) => p.code === code)?.val;

    if (type === 'LINE') {
      out.lines.push({ x1: num(first(10) ?? '0'), y1: num(first(20) ?? '0'), x2: num(first(11) ?? '0'), y2: num(first(21) ?? '0') });
    } else if (type === 'LWPOLYLINE') {
      const flags = parseInt(first(70) ?? '0', 10) || 0;
      const pts: { x: number; y: number }[] = [];
      // 10/20 pairs repeat per vertex, IN ORDER
      for (let k = 0; k < body.length; k++) {
        if (body[k].code === 10) {
          const x = num(body[k].val);
          const yPair = body[k + 1]?.code === 20 ? body[k + 1].val : undefined;
          pts.push({ x, y: num(yPair ?? '0') });
        }
      }
      if (pts.length >= 2) out.polylines.push({ pts, closed: (flags & 1) === 1 });
    } else if (type === 'POLYLINE') {
      // old-style: header POLYLINE, then VERTEX entities, then SEQEND
      const flags = parseInt(first(70) ?? '0', 10) || 0;
      const pts: { x: number; y: number }[] = [];
      while (i < n) {
        if (pairs[i].code === 0 && pairs[i].val.trim() === 'VERTEX') {
          i++;
          const vb: Pair[] = [];
          while (i < n && pairs[i].code !== 0) { vb.push(pairs[i]); i++; }
          pts.push({ x: num(vb.find((p) => p.code === 10)?.val ?? '0'), y: num(vb.find((p) => p.code === 20)?.val ?? '0') });
        } else if (pairs[i].code === 0 && pairs[i].val.trim() === 'SEQEND') {
          i++; // consume SEQEND header
          while (i < n && pairs[i].code !== 0) i++;
          break;
        } else break;
      }
      if (pts.length >= 2) out.polylines.push({ pts, closed: (flags & 1) === 1 });
    } else if (type === 'CIRCLE') {
      out.circles.push({ cx: num(first(10) ?? '0'), cy: num(first(20) ?? '0'), r: num(first(40) ?? '0') });
    } else if (type === 'ARC') {
      out.arcs.push({ cx: num(first(10) ?? '0'), cy: num(first(20) ?? '0'), r: num(first(40) ?? '0'), startDeg: num(first(50) ?? '0'), endDeg: num(first(51) ?? '0') });
    }
  }

  out.ok = out.lines.length + out.polylines.length + out.circles.length + out.arcs.length > 0;
  if (!out.ok) out.error = 'No usable geometry (LINE/LWPOLYLINE/POLYLINE/CIRCLE/ARC) found';
  return out;
}

/** Convenience: total LF of all lines + polyline edges, in FEET (applies insUnits). */
export function dxfLinearFeet(r: DxfResult): number {
  const f = insUnitsToFeet(r.insUnits);
  let px = 0;
  for (const l of r.lines) px += Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
  for (const p of r.polylines) {
    const ring = p.closed ? [...p.pts, p.pts[0]] : p.pts;
    for (let k = 1; k < ring.length; k++) px += Math.hypot(ring[k].x - ring[k - 1].x, ring[k].y - ring[k - 1].y);
  }
  return Math.round(px * f * 100) / 100;
}

/** Convenience: total SF of all CLOSED polylines (shoelace), in FEET². */
export function dxfClosedAreaSF(r: DxfResult): number {
  const f = insUnitsToFeet(r.insUnits);
  let sf = 0;
  for (const p of r.polylines) {
    if (!p.closed || p.pts.length < 3) continue;
    let a = 0;
    for (let k = 0; k < p.pts.length; k++) { const q = p.pts[(k + 1) % p.pts.length]; a += p.pts[k].x * q.y - q.x * p.pts[k].y; }
    sf += Math.abs(a / 2);
  }
  return Math.round(sf * f * f * 100) / 100;
}
