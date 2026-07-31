/**
 * Heatmap engine — VECTOR PDF / CAD PARSER.
 *
 * Survey-grade wall + scale extraction from a *vector* PDF (an architectural CAD
 * export), with zero AI raster guessing. We walk the PDF content stream's
 * operator list, reconstruct every drawn edge in real PDF user space (applying
 * the current transform matrix), flip to a top-left image origin, merge
 * duplicate / collinear-overlapping strokes, and — best-effort — read the
 * drawing scale from dimension strings or a "SCALE 1/4\"=1'-0\"" note.
 *
 * Runs SERVER-SIDE in Node with pdfjs-dist's legacy build (no DOM, no worker).
 * The output feeds the Coverage Heatmap tool: exact `walls` + a `pxPerFt` the UI
 * can trust, or a clean `null` so the UI falls back to tap-two-points calibration.
 *
 * Pure & deterministic: no Date.now / Math.random anywhere. Coordinates in the
 * returned segments/texts are in PDF points (1/72"), top-left origin (y flipped).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VectorSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** length in PDF points (real page units, i.e. after the CTM is applied) */
  len: number;
}

export interface VectorText {
  str: string;
  x: number;
  y: number;
}

export interface DetectedScale {
  pxPerFt: number;
  /** how it was derived: 'scale-note' | 'dimension' */
  source: string;
}

export interface VectorPdfResult {
  ok: boolean;
  error?: string;
  pageWidthPt: number;
  pageHeightPt: number;
  /** all merged vector segments (raw linework — walls + furniture + dims + text strokes) */
  segments: VectorSegment[];
  /** wall CENTERLINES only: clutter dropped by length + parallel faces collapsed to one
   *  line. This is what the coverage model should consume (segments double-counts faces). */
  walls: VectorSegment[];
  texts: VectorText[];
  detectedScale: DetectedScale | null;
}

/* ── 2×3 affine matrix helpers (PDF convention [a,b,c,d,e,f]) ─────────────────
 * A point (x,y) maps to (a*x + c*y + e,  b*x + d*y + f).
 */
type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** Compose m1 ∘ m2 (apply m2 first, then m1). Matches pdfjs Util.transform. */
function matMul(m1: Mat, m2: Mat): Mat {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/* ── tolerances (points) — deterministic constants ───────────────────────── */
const MIN_LEN = 0.5;          // drop zero/near-zero noise edges
const ROUND = 0.01;           // coordinate snap for dedup stability
const ANGLE_TOL = 0.5 * (Math.PI / 180); // collinear merge: ~0.5° parallel tolerance
const OFFSET_TOL = 1.0;       // collinear merge: perpendicular offset tolerance
const GAP_TOL = 0.75;         // collinear merge: max end-to-end gap to still join

const round = (v: number) => Math.round(v / ROUND) * ROUND;

/* ── main entry ──────────────────────────────────────────────────────────── */

export async function parseVectorPdf(
  data: Uint8Array | ArrayBuffer,
  opts?: { page?: number },
): Promise<VectorPdfResult> {
  const EMPTY: VectorPdfResult = {
    ok: false,
    pageWidthPt: 0,
    pageHeightPt: 0,
    segments: [],
    walls: [],
    texts: [],
    detectedScale: null,
  };

  // Copy into a fresh buffer — pdfjs may detach/transfer the underlying bytes.
  let bytes: Uint8Array;
  try {
    bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  } catch {
    return { ...EMPTY, error: 'Invalid PDF data' };
  }
  if (!bytes.length) return { ...EMPTY, error: 'Empty PDF data' };

  let pdfjs: any;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (err: any) {
    return { ...EMPTY, error: `PDF engine failed to load: ${err?.message || 'unknown'}` };
  }

  // Node has no browser worker — pdfjs falls back to its in-process "fake
  // worker" automatically; make sure nothing points at a nonexistent worker URL.
  try {
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '';
    }
  } catch {
    /* non-fatal */
  }

  let pdf: any;
  try {
    pdf = await pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      // Errors only — we don't render glyphs, so the benign "standard font"
      // measurement warnings for non-embedded base-14 fonts are just noise.
      verbosity: 0,
    }).promise;
  } catch (err: any) {
    return { ...EMPTY, error: `Could not open PDF: ${err?.message || 'unknown error'}` };
  }

  try {
    const OPS = pdfjs.OPS;
    const numPages: number = pdf.numPages || 1;
    const pageNo = Math.min(Math.max(1, Math.floor(opts?.page ?? 1)), numPages);
    const page = await pdf.getPage(pageNo);

    // MediaBox → page dimensions + the flip reference.
    const view: number[] = page.view || [0, 0, 0, 0];
    const [vx0, vy0, vx1, vy1] = view;
    const pageWidthPt = Math.abs(vx1 - vx0);
    const pageHeightPt = Math.abs(vy1 - vy0);

    // Convert a base-space (PDF user space) point to top-left image space.
    const toImg = (bx: number, by: number): [number, number] => [bx - vx0, vy1 - by];

    const rawSegments: VectorSegment[] = [];

    const opList = await page.getOperatorList();
    const fnArray: number[] = opList.fnArray;
    const argsArray: any[] = opList.argsArray;

    // Graphics-state transform stack.
    let ctm: Mat = IDENTITY;
    const ctmStack: Mat[] = [];

    // Persistent path cursor for any (rare) un-fused top-level path ops.
    const pathState = { cx: 0, cy: 0, sx: 0, sy: 0 };

    const emitEdge = (m: Mat, lx1: number, ly1: number, lx2: number, ly2: number) => {
      const [b1x, b1y] = apply(m, lx1, ly1);
      const [b2x, b2y] = apply(m, lx2, ly2);
      const [X1, Y1] = toImg(b1x, b1y);
      const [X2, Y2] = toImg(b2x, b2y);
      const len = Math.hypot(X2 - X1, Y2 - Y1);
      if (len >= MIN_LEN) rawSegments.push({ x1: X1, y1: Y1, x2: X2, y2: Y2, len });
    };

    // Run a path op-code with a mutable {cx,cy,sx,sy} cursor under transform m.
    const runPathOp = (
      code: number,
      a: number[],
      st: { cx: number; cy: number; sx: number; sy: number },
      m: Mat,
    ) => {
      switch (code) {
        case OPS.moveTo:
          st.cx = a[0]; st.cy = a[1]; st.sx = a[0]; st.sy = a[1];
          break;
        case OPS.lineTo:
          emitEdge(m, st.cx, st.cy, a[0], a[1]);
          st.cx = a[0]; st.cy = a[1];
          break;
        case OPS.curveTo: // cubic: endpoint at [4],[5] — approximated as a chord
          emitEdge(m, st.cx, st.cy, a[4], a[5]);
          st.cx = a[4]; st.cy = a[5];
          break;
        case OPS.curveTo2: // endpoint at [2],[3]
          emitEdge(m, st.cx, st.cy, a[2], a[3]);
          st.cx = a[2]; st.cy = a[3];
          break;
        case OPS.curveTo3: // endpoint at [2],[3]
          emitEdge(m, st.cx, st.cy, a[2], a[3]);
          st.cx = a[2]; st.cy = a[3];
          break;
        case OPS.rectangle: {
          const rx = a[0], ry = a[1], rw = a[2], rh = a[3];
          emitEdge(m, rx, ry, rx + rw, ry);
          emitEdge(m, rx + rw, ry, rx + rw, ry + rh);
          emitEdge(m, rx + rw, ry + rh, rx, ry + rh);
          emitEdge(m, rx, ry + rh, rx, ry);
          st.cx = rx; st.cy = ry; st.sx = rx; st.sy = ry;
          break;
        }
        case OPS.closePath:
          emitEdge(m, st.cx, st.cy, st.sx, st.sy);
          st.cx = st.sx; st.cy = st.sy;
          break;
        default:
          break;
      }
    };

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      if (fn === OPS.save) {
        ctmStack.push(ctm);
      } else if (fn === OPS.restore) {
        ctm = ctmStack.pop() ?? IDENTITY;
      } else if (fn === OPS.transform) {
        const a = argsArray[i] as number[];
        ctm = matMul(ctm, [a[0], a[1], a[2], a[3], a[4], a[5]] as Mat);
      } else if (fn === OPS.constructPath) {
        // Fused path: argsArray[i] = [subOps[], flatArgs[], minMax]
        const bundle = argsArray[i];
        const subOps: number[] = bundle[0];
        const flat: number[] = bundle[1];
        const local = { cx: 0, cy: 0, sx: 0, sy: 0 };
        let j = 0;
        for (let k = 0; k < subOps.length; k++) {
          const code = subOps[k] | 0;
          if (code === OPS.moveTo) { runPathOp(code, [flat[j], flat[j + 1]], local, ctm); j += 2; }
          else if (code === OPS.lineTo) { runPathOp(code, [flat[j], flat[j + 1]], local, ctm); j += 2; }
          else if (code === OPS.curveTo) { runPathOp(code, [flat[j], flat[j + 1], flat[j + 2], flat[j + 3], flat[j + 4], flat[j + 5]], local, ctm); j += 6; }
          else if (code === OPS.curveTo2) { runPathOp(code, [flat[j], flat[j + 1], flat[j + 2], flat[j + 3]], local, ctm); j += 4; }
          else if (code === OPS.curveTo3) { runPathOp(code, [flat[j], flat[j + 1], flat[j + 2], flat[j + 3]], local, ctm); j += 4; }
          else if (code === OPS.rectangle) { runPathOp(code, [flat[j], flat[j + 1], flat[j + 2], flat[j + 3]], local, ctm); j += 4; }
          else if (code === OPS.closePath) { runPathOp(code, [], local, ctm); }
        }
      } else if (
        fn === OPS.moveTo || fn === OPS.lineTo || fn === OPS.curveTo ||
        fn === OPS.curveTo2 || fn === OPS.curveTo3 || fn === OPS.rectangle || fn === OPS.closePath
      ) {
        runPathOp(fn, (argsArray[i] as number[]) || [], pathState, ctm);
      }
    }

    // Text — same flipped coordinate space. Keep the baseline angle internally
    // (for scale detection) but only expose {str,x,y}.
    const richTexts: { str: string; x: number; y: number; angle: number }[] = [];
    try {
      const tc = await page.getTextContent();
      for (const it of tc.items as any[]) {
        const s = typeof it.str === 'string' ? it.str : '';
        if (!s.trim()) continue;
        const t: number[] = it.transform || [1, 0, 0, 1, 0, 0];
        const [bx, by] = [t[4], t[5]];
        const [X, Y] = toImg(bx, by);
        const angle = Math.atan2(t[1], t[0]); // text baseline direction
        richTexts.push({ str: s, x: X, y: Y, angle });
      }
    } catch {
      /* text is best-effort; geometry is the primary product */
    }

    const segments = mergeSegments(rawSegments);
    const texts: VectorText[] = richTexts.map((t) => ({ str: t.str, x: t.x, y: t.y }));

    if (!segments.length) {
      return {
        ...EMPTY,
        pageWidthPt,
        pageHeightPt,
        texts,
        error:
          'No vector geometry found — this looks like a scanned image; use AI scan or set scale manually',
      };
    }

    const detectedScale = detectScale(segments, richTexts);
    const walls = classifyWalls(segments, detectedScale?.pxPerFt ?? null, pageWidthPt, pageHeightPt);

    return { ok: true, pageWidthPt, pageHeightPt, segments, walls, texts, detectedScale };
  } catch (err: any) {
    return { ...EMPTY, error: `Vector parse failed: ${err?.message || 'unknown error'}` };
  }
}

/* ── segment merge: exact dup + near-collinear overlap ───────────────────── */

function mergeSegments(input: VectorSegment[]): VectorSegment[] {
  // 1) snap + canonical endpoint order + exact-dup dedup.
  const seen = new Set<string>();
  const segs: VectorSegment[] = [];
  for (const s of input) {
    let x1 = round(s.x1), y1 = round(s.y1), x2 = round(s.x2), y2 = round(s.y2);
    // canonical order (lexicographic) so A→B and B→A dedup identically
    if (x2 < x1 || (x2 === x1 && y2 < y1)) { [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1]; }
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < MIN_LEN) continue;
    const key = `${x1}:${y1}:${x2}:${y2}`;
    if (seen.has(key)) continue;
    seen.add(key);
    segs.push({ x1, y1, x2, y2, len });
  }

  // 2) group collinear segments (same infinite line within tolerance) and merge
  //    overlapping/touching spans. Non-overlapping collinear pieces stay split.
  interface Rec { seg: VectorSegment; theta: number; offset: number }
  const recs: Rec[] = segs.map((seg) => {
    let theta = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    if (theta < 0) theta += Math.PI;       // undirected → [0, π)
    if (theta >= Math.PI) theta -= Math.PI;
    const nx = -Math.sin(theta), ny = Math.cos(theta);
    const offset = nx * seg.x1 + ny * seg.y1; // signed perp distance from origin
    return { seg, theta, offset };
  });

  // deterministic order: by angle, then offset, then position along the line
  recs.sort((a, b) => {
    if (a.theta !== b.theta) return a.theta - b.theta;
    if (a.offset !== b.offset) return a.offset - b.offset;
    const at = Math.min(a.seg.x1, a.seg.x2), bt = Math.min(b.seg.x1, b.seg.x2);
    if (at !== bt) return at - bt;
    return Math.min(a.seg.y1, a.seg.y2) - Math.min(b.seg.y1, b.seg.y2);
  });

  const used = new Array(recs.length).fill(false);
  const out: VectorSegment[] = [];

  for (let i = 0; i < recs.length; i++) {
    if (used[i]) continue;
    const base = recs[i];
    const cos = Math.cos(base.theta), sin = Math.sin(base.theta);
    // gather all not-yet-used recs collinear with `base`
    const group: Rec[] = [];
    for (let k = i; k < recs.length; k++) {
      if (used[k]) continue;
      const r = recs[k];
      let dTheta = Math.abs(r.theta - base.theta);
      if (dTheta > Math.PI / 2) dTheta = Math.PI - dTheta; // wrap near 0/π
      if (dTheta <= ANGLE_TOL && Math.abs(r.offset - base.offset) <= OFFSET_TOL) {
        used[k] = true;
        group.push(r);
      }
    }
    // project every endpoint onto the base direction, build [t] intervals
    const intervals: { lo: number; hi: number }[] = group.map((r) => {
      const t1 = r.seg.x1 * cos + r.seg.y1 * sin;
      const t2 = r.seg.x2 * cos + r.seg.y2 * sin;
      return { lo: Math.min(t1, t2), hi: Math.max(t1, t2) };
    });
    intervals.sort((a, b) => a.lo - b.lo);
    // representative line point (perp offset carried by base.offset)
    const px = -Math.sin(base.theta) * base.offset;
    const py = Math.cos(base.theta) * base.offset;
    let cur = { ...intervals[0] };
    const flush = () => {
      const ax = px + cos * cur.lo, ay = py + sin * cur.lo;
      const bx = px + cos * cur.hi, by = py + sin * cur.hi;
      let x1 = round(ax), y1 = round(ay), x2 = round(bx), y2 = round(by);
      if (x2 < x1 || (x2 === x1 && y2 < y1)) { [x1, x2] = [x2, x1]; [y1, y2] = [y2, y1]; }
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len >= MIN_LEN) out.push({ x1, y1, x2, y2, len });
    };
    for (let m = 1; m < intervals.length; m++) {
      const iv = intervals[m];
      if (iv.lo <= cur.hi + GAP_TOL) {
        if (iv.hi > cur.hi) cur.hi = iv.hi; // overlap/adjacent → extend
      } else {
        flush();
        cur = { ...iv };
      }
    }
    flush();
  }

  // stable final order for determinism
  out.sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1 || a.x2 - b.x2 || a.y2 - b.y2);
  return out;
}

/* ── wall classification: drop non-wall clutter + collapse parallel wall faces ─────
 * Vector CAD gives us no layer info here, so we classify GEOMETRICALLY:
 *  - LENGTH: real walls span rooms; dimension ticks/leaders, furniture edges, door
 *    swings, grid bubbles and title-block text are mostly short. Drop anything below a
 *    wall-length floor (feet-based when a scale is known, else page-relative).
 *  - PARALLEL FACES: a drawn wall is TWO parallel lines a wall-thickness apart. Collapse a
 *    near-parallel, overlapping pair within a plausible thickness gap into ONE centerline,
 *    so the RF model isn't fed doubled walls.
 * Honest limit: a long straight casework/furniture edge can still read as a wall — this is
 * a deterministic heuristic, not layer-accurate CAD parsing.
 */
export function classifyWalls(
  segments: VectorSegment[],
  pxPerFt: number | null,
  pageWidthPt: number,
  pageHeightPt: number,
): VectorSegment[] {
  if (!segments.length) return [];
  const diag = Math.hypot(pageWidthPt, pageHeightPt) || 1;
  const minWall = pxPerFt ? pxPerFt * 1.5 : diag * 0.025;        // wall-length floor
  const faceMin = pxPerFt ? pxPerFt * (2 / 12) : diag * 0.004;   // ~2"  thinnest wall
  const faceMax = pxPerFt ? pxPerFt * (16 / 12) : diag * 0.03;   // ~16" thickest wall
  const PAR_ANGLE = 3 * (Math.PI / 180);

  const dirOf = (s: VectorSegment) => {
    let t = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    if (t < 0) t += Math.PI;
    if (t >= Math.PI) t -= Math.PI;
    return t;
  };

  const cand = segments.filter((s) => s.len >= minWall);
  const used = new Array(cand.length).fill(false);
  const walls: VectorSegment[] = [];

  for (let i = 0; i < cand.length; i++) {
    if (used[i]) continue;
    const a = cand[i];
    const ta = dirOf(a);
    const cos = Math.cos(ta), sin = Math.sin(ta);
    const nx = -Math.sin(ta), ny = Math.cos(ta);
    const offA = nx * a.x1 + ny * a.y1;
    const a1 = a.x1 * cos + a.y1 * sin, a2 = a.x2 * cos + a.y2 * sin;
    const aLo = Math.min(a1, a2), aHi = Math.max(a1, a2);

    let pair = -1;
    for (let j = i + 1; j < cand.length; j++) {
      if (used[j]) continue;
      const b = cand[j];
      let dT = Math.abs(dirOf(b) - ta);
      if (dT > Math.PI / 2) dT = Math.PI - dT;
      if (dT > PAR_ANGLE) continue;
      const gap = Math.abs((nx * b.x1 + ny * b.y1) - offA);
      if (gap < faceMin || gap > faceMax) continue;
      const b1 = b.x1 * cos + b.y1 * sin, b2 = b.x2 * cos + b.y2 * sin;
      const bLo = Math.min(b1, b2), bHi = Math.max(b1, b2);
      const ov = Math.min(aHi, bHi) - Math.max(aLo, bLo);
      if (ov > 0.5 * Math.min(aHi - aLo, bHi - bLo)) { pair = j; break; }
    }

    if (pair >= 0) {
      const b = cand[pair];
      used[pair] = true;
      const offMid = (offA + (nx * b.x1 + ny * b.y1)) / 2;
      const b1 = b.x1 * cos + b.y1 * sin, b2 = b.x2 * cos + b.y2 * sin;
      const lo = Math.max(aLo, Math.min(b1, b2)), hi = Math.min(aHi, Math.max(b1, b2));
      const mx = nx * offMid, my = ny * offMid;
      const x1 = round(mx + cos * lo), y1 = round(my + sin * lo);
      const x2 = round(mx + cos * hi), y2 = round(my + sin * hi);
      const len = Math.hypot(x2 - x1, y2 - y1);
      walls.push(len >= minWall * 0.6 ? { x1, y1, x2, y2, len } : { ...a });
    } else {
      walls.push({ ...a });
    }
    used[i] = true;
  }
  return walls;
}

/* ── scale detection ─────────────────────────────────────────────────────── */

function detectScale(
  segments: VectorSegment[],
  texts: { str: string; x: number; y: number; angle: number }[],
): DetectedScale | null {
  // Explicit scale note is the gold standard — try it first.
  const note = detectScaleNote(texts);
  if (note) return note;
  return detectScaleFromDimensions(segments, texts);
}

/** Parse a fraction like "1/4" or a decimal like "0.25" or "3". */
function parseNumberToken(tok: string): number | null {
  tok = tok.trim();
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(tok);
  if (frac) {
    const d = Number(frac[2]);
    if (!d) return null;
    return Number(frac[1]) / d;
  }
  const n = Number(tok);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an architectural / metric dimension label to a length in FEET.
 * Handles: 20'-6"  24'  10'-6"  12.5'  3.5 m  1200 mm  8 ft
 */
export function parseArchLength(raw: string): number | null {
  const s = raw.trim();

  // metric
  const met = /(-?\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i.exec(s);
  if (met) {
    const v = Number(met[1]);
    if (!Number.isFinite(v)) return null;
    const unit = met[2].toLowerCase();
    const meters = unit === 'mm' ? v / 1000 : unit === 'cm' ? v / 100 : v;
    const ft = meters * 3.280839895;
    return ft > 0 ? ft : null;
  }

  // feet(') with optional -inches(")
  const fi = /(\d+(?:\.\d+)?)\s*['′]\s*(?:-\s*)?(\d+(?:\.\d+)?)?\s*(?:["″])?/.exec(s);
  if (fi) {
    const feet = Number(fi[1]);
    const inches = fi[2] != null ? Number(fi[2]) : 0;
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
    const ft = feet + inches / 12;
    return ft > 0 ? ft : null;
  }

  // decimal feet with ft/feet
  const ft = /(\d+(?:\.\d+)?)\s*(?:ft|feet)\b/i.exec(s);
  if (ft) {
    const v = Number(ft[1]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  return null;
}

/**
 * Parse a plot-scale note into pxPerFt, assuming the PDF user unit is 1/72".
 *  - Architectural: 1/4"=1'-0"   →  0.25in/ft × 72 = 18 px/ft
 *  - Engineering:   1"=20'       →  1in/20ft × 72 = 3.6 px/ft
 *  - Ratio:         1:50         →  12in × 72 / 50 = 17.28 px/ft
 */
export function parseScaleNote(raw: string): number | null {
  const s = raw.trim();

  // A" = B'-C"   (A may be a fraction)
  const arch = /(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*["″]\s*=\s*(\d+(?:\.\d+)?)\s*['′](?:\s*-?\s*(\d+(?:\.\d+)?)\s*["″])?/.exec(s);
  if (arch) {
    const paperIn = parseNumberToken(arch[1]);
    const feet = Number(arch[2]) + (arch[3] != null ? Number(arch[3]) / 12 : 0);
    if (paperIn && feet > 0) {
      const px = (paperIn / feet) * 72;
      if (Number.isFinite(px) && px > 0) return px;
    }
  }

  // ratio 1:R (only when the word "scale" is present, to avoid false positives)
  if (/scale/i.test(s)) {
    const ratio = /1\s*:\s*(\d+(?:\.\d+)?)/.exec(s);
    if (ratio) {
      const r = Number(ratio[1]);
      if (r > 0) {
        const px = (12 * 72) / r;
        if (Number.isFinite(px) && px > 0) return px;
      }
    }
  }

  return null;
}

function detectScaleNote(texts: { str: string }[]): DetectedScale | null {
  for (const t of texts) {
    const px = parseScaleNote(t.str);
    if (px && px > 0) return { pxPerFt: round4(px), source: 'scale-note' };
  }
  return null;
}

const DIM_ANGLE_TOL = 15 * (Math.PI / 180); // dimension text must be ~parallel to its segment
const DIM_MIN_SEG = 20;                      // ignore tiny segments as dimension targets
const SANE_MIN = 1;                          // px/ft plausibility band
const SANE_MAX = 300;

/**
 * Best-effort: match architectural dimension labels to the wall segment they
 * annotate (parallel + nearby + text projects onto the span) and derive pxPerFt.
 * Median of all confident matches, or null. NEVER guesses when nothing lines up.
 */
function detectScaleFromDimensions(
  segments: VectorSegment[],
  texts: { str: string; x: number; y: number; angle: number }[],
): DetectedScale | null {
  const candidates: number[] = [];

  for (const t of texts) {
    const feet = parseArchLength(t.str);
    if (!feet || feet <= 0) continue;

    let textTheta = t.angle;
    if (textTheta < 0) textTheta += Math.PI;
    if (textTheta >= Math.PI) textTheta -= Math.PI;

    let best: { perp: number; len: number; idx: number } | null = null;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s.len < DIM_MIN_SEG) continue;

      let segTheta = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      if (segTheta < 0) segTheta += Math.PI;
      if (segTheta >= Math.PI) segTheta -= Math.PI;

      let dTheta = Math.abs(segTheta - textTheta);
      if (dTheta > Math.PI / 2) dTheta = Math.PI - dTheta;
      if (dTheta > DIM_ANGLE_TOL) continue; // must annotate a parallel segment

      // perpendicular distance from text anchor to the segment's infinite line
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const nx = -uy, ny = ux;
      const perp = Math.abs((t.x - s.x1) * nx + (t.y - s.y1) * ny);
      if (perp > Math.max(28, 0.1 * s.len)) continue;

      // text must project onto the segment span (with a margin past the ends)
      const proj = (t.x - s.x1) * ux + (t.y - s.y1) * uy;
      const margin = 0.25 * s.len;
      if (proj < -margin || proj > s.len + margin) continue;

      if (!best || perp < best.perp || (perp === best.perp && s.len > best.len)) {
        best = { perp, len: s.len, idx: i };
      }
    }

    if (best) {
      const pxPerFt = best.len / feet;
      if (Number.isFinite(pxPerFt) && pxPerFt >= SANE_MIN && pxPerFt <= SANE_MAX) {
        candidates.push(pxPerFt);
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a - b);
  const mid = Math.floor((candidates.length - 1) / 2); // lower-middle for determinism
  return { pxPerFt: round4(candidates[mid]), source: 'dimension' };
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;
