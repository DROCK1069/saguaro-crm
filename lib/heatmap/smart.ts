/**
 * Heatmap engine — smart layer: auto-placement (greedy set-cover), gap detection
 * (flood-fill CCL), WiFi channel planning (DSATUR-style), and coverage metrics.
 */
import type { Pt } from './geometry';
import { dist } from './geometry';
import type { Band, CoverageResult, Device, GapRegion, HeatmapProject } from './types';
import { apRssiAt, apUsableRadiusFt, computeCoverage, type CoverageOpts } from './engine';
import { CHANNELS_24, CHANNELS_5 } from './models';
import { UNIFI_APS } from './unifi';
import type { UnifiAP } from './unifi';

let _idc = 0;
const uid = () => `ap_auto_${Date.now().toString(36)}_${_idc++}`;

/** Match a requested model name against the UniFi catalog (with/without the "UniFi " prefix). */
function findUnifiAp(name?: string): UnifiAP | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return UNIFI_APS.find(
    (a) => a.model.toLowerCase() === n || a.model.replace(/^UniFi\s+/i, '').toLowerCase() === n,
  );
}

/** Resolve the AP model to place: explicit opts.apModel, else a strong ceiling flagship. */
function resolveApModel(apModel?: string): UnifiAP {
  return (
    findUnifiAp(apModel) ||
    findUnifiAp('UniFi U7 Pro') ||
    UNIFI_APS.find((a) => a.form === 'ceiling' && !a.outdoor) ||
    UNIFI_APS[0]
  );
}

/** Pick the band to model for a given AP: the requested band if the model supports it, else 5/first. */
function resolveBand(model: UnifiAP, want: Band): Band {
  if (model.txDbm[want] != null) return want;
  if (model.txDbm['5'] != null) return '5';
  const first = Object.keys(model.txDbm)[0] as Band | undefined;
  return first ?? '5';
}

/**
 * Greedy max-coverage AP auto-placement to hit targetPct at rssiTargetDbm, using a REAL
 * UniFi AP model (per-band TX power + antenna gain) so coverage math and BOM pricing are accurate.
 * Returns the placed devices plus the coverage % achieved over the eval grid and whether it met target.
 */
export function autoPlaceAPs(
  p: HeatmapProject,
  opts: {
    targetPct?: number; maxDevices?: number; band?: Band; apModel?: string;
    /** Explicit radio override (multi-vendor): when tx+gain are given, model any
     *  vendor's AP without needing it in the UniFi catalog. UniFi path is unchanged
     *  when these are omitted. */
    txPowerDbm?: number; antennaGainDbi?: number; label?: string;
  } = {},
): { aps: Device[]; achievedPct: number; metTarget: boolean } {
  const empty = { aps: [] as Device[], achievedPct: 0, metTarget: false };
  if (!p.scale) return empty;
  const targetPct = opts.targetPct ?? 0.92;
  const maxDevices = opts.maxDevices ?? 40;
  const target = p.rssiTargetDbm;

  // Resolve the band/TX/gain to model with. An explicit tx+gain (any vendor) wins;
  // otherwise fall back to the real UniFi catalog model (unchanged default behavior).
  const useExplicit = opts.txPowerDbm != null && opts.antennaGainDbi != null;
  const model = useExplicit ? null : resolveApModel(opts.apModel);
  const band = useExplicit ? (opts.band ?? '5') : resolveBand(model!, opts.band ?? '5');
  const modelTxDbm = useExplicit ? opts.txPowerDbm! : (model!.txDbm[band] ?? model!.txDbm['5'] ?? 15);
  const modelGainDbi = useExplicit ? opts.antennaGainDbi! : model!.gainDbi;
  const modelLabel = useExplicit ? (opts.label ?? 'AP') : model!.model;
  // engine's apRssiAt / apUsableRadiusFt take a combined EIRP-style tx+gain figure.
  const txGain = modelTxDbm + modelGainDbi;

  // Grid of evaluation cells (coarse for speed)
  const step = Math.max(14, Math.round(Math.min(p.imgW, p.imgH) / 60));
  const cells: Pt[] = [];
  for (let y = step / 2; y < p.imgH; y += step)
    for (let x = step / 2; x < p.imgW; x += step) cells.push({ x, y });
  const N = cells.length;
  if (!N) return empty;

  // Candidate lattice ≈ half usable radius (in px)
  const radiusPx = apUsableRadiusFt(p, band, txGain, target) * p.scale.pxPerFt;
  const cand = Math.max(step, radiusPx * 0.55);
  const candidates: Pt[] = [];
  for (let y = cand / 2; y < p.imgH; y += cand)
    for (let x = cand / 2; x < p.imgW; x += cand) candidates.push({ x, y });

  // footprint bitset per candidate (cells covered ≥ target) using the chosen model's TX/gain
  const footprints: number[][] = candidates.map((cp) => {
    const fp: number[] = [];
    for (let i = 0; i < N; i++) if (apRssiAt(cells[i], cp, p, band, txGain) >= target) fp.push(i);
    return fp;
  });

  const covered = new Uint8Array(N);
  let coveredCount = 0;
  // seed with existing APs' coverage so auto-place fills gaps around them —
  // using each existing AP's OWN band / TX power / antenna gain (not a hard-coded figure).
  const existing = p.devices.filter((d) => d.typeId === 'wifi_ap');
  for (let i = 0; i < N; i++) {
    for (const ap of existing) {
      const apBand = (ap.band ?? '5') as Band;
      const apTxGain = (ap.txPowerDbm ?? 15) + (ap.antennaGainDbi ?? 3);
      if (apRssiAt(cells[i], ap.pos, p, apBand, apTxGain) >= target) {
        if (!covered[i]) { covered[i] = 1; coveredCount++; }
        break;
      }
    }
  }

  const placed: Device[] = [];
  while (coveredCount / N < targetPct && placed.length < maxDevices) {
    let best = -1, bestGain = 0;
    for (let c = 0; c < candidates.length; c++) {
      let g = 0;
      for (const i of footprints[c]) if (!covered[i]) g++;
      if (g > bestGain) { bestGain = g; best = c; }
    }
    if (best < 0 || bestGain === 0) break;
    for (const i of footprints[best]) if (!covered[i]) { covered[i] = 1; coveredCount++; }
    placed.push({
      id: uid(), typeId: 'wifi_ap', pos: { ...candidates[best] }, band,
      txPowerDbm: modelTxDbm, antennaGainDbi: modelGainDbi, label: modelLabel,
    });
  }

  const achievedPct = N ? coveredCount / N : 0;
  return { aps: placed, achievedPct, metTarget: achievedPct >= targetPct };
}

/** Flood-fill dead-zone regions from a computed RF coverage result. */
export function detectGaps(
  res: CoverageResult, p: HeatmapProject,
): { count: number; totalAreaFt2: number; regions: GapRegion[] } {
  const { cols, rows, cells, cellPx } = res;
  const isWeak = (i: number) => cells[i] != null && !cells[i]!.covered;
  const seen = new Uint8Array(cols * rows);
  const regions: GapRegion[] = [];
  const ftPerCell = p.scale ? cellPx / p.scale.pxPerFt : 1;
  const cellAreaFt2 = ftPerCell * ftPerCell;
  const minCells = 6;

  for (let start = 0; start < cols * rows; start++) {
    if (seen[start] || !isWeak(start)) continue;
    const stack = [start]; seen[start] = 1;
    const comp: number[] = [];
    while (stack.length) {
      const q = stack.pop()!; comp.push(q);
      const r = Math.floor(q / cols), c = q % cols;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const ni = nr * cols + nc;
        if (!seen[ni] && isWeak(ni)) { seen[ni] = 1; stack.push(ni); }
      }
    }
    if (comp.length < minCells) continue;
    let sx = 0, sy = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, worst = 0;
    for (const i of comp) {
      const cx = (i % cols) * cellPx + cellPx / 2, cy = Math.floor(i / cols) * cellPx + cellPx / 2;
      sx += cx; sy += cy;
      minx = Math.min(minx, cx - cellPx / 2); miny = Math.min(miny, cy - cellPx / 2);
      maxx = Math.max(maxx, cx + cellPx / 2); maxy = Math.max(maxy, cy + cellPx / 2);
      const v = cells[i]?.value ?? 0; if (v < worst) worst = v;
    }
    regions.push({ area: comp.length * cellAreaFt2, centroid: { x: sx / comp.length, y: sy / comp.length }, bbox: { x: minx, y: miny, w: maxx - minx, h: maxy - miny }, worst });
  }
  regions.sort((a, b) => b.area - a.area);
  return { count: regions.length, totalAreaFt2: regions.reduce((s, r) => s + r.area, 0), regions };
}

/** Assign non-overlapping channels to APs (greedy saturation, by proximity/overlap). */
export function planChannels(p: HeatmapProject, band: '2.4' | '5' = '2.4'): Record<string, number> {
  const aps = p.devices.filter((d) => d.typeId === 'wifi_ap');
  const palette = band === '2.4' ? CHANNELS_24 : CHANNELS_5;
  // interference edge if APs closer than ~1.4× usable radius (footprints overlap)
  const rPx = (p.scale ? apUsableRadiusFt(p, band, 18, p.rssiTargetDbm) * p.scale.pxPerFt : 300) * 1.4;
  const adj: Record<string, Set<string>> = {};
  aps.forEach((a) => (adj[a.id] = new Set()));
  for (let i = 0; i < aps.length; i++)
    for (let j = i + 1; j < aps.length; j++)
      if (dist(aps[i].pos, aps[j].pos) < rPx) { adj[aps[i].id].add(aps[j].id); adj[aps[j].id].add(aps[i].id); }

  const color: Record<string, number> = {};
  // DSATUR: repeatedly pick uncolored AP with most distinct neighbor-colors
  const uncolored = new Set(aps.map((a) => a.id));
  while (uncolored.size) {
    let pick = '', bestSat = -1, bestDeg = -1;
    for (const id of uncolored) {
      const nbColors = new Set<number>();
      for (const n of adj[id]) if (color[n] != null) nbColors.add(color[n]);
      const deg = adj[id].size;
      if (nbColors.size > bestSat || (nbColors.size === bestSat && deg > bestDeg)) { bestSat = nbColors.size; bestDeg = deg; pick = id; }
    }
    const used = new Set<number>();
    for (const n of adj[pick]) if (color[n] != null) used.add(color[n]);
    let chosen = palette.find((ch) => !used.has(ch));
    if (chosen == null) {
      // more conflicts than colors: reuse the least-used channel among neighbors
      const counts: Record<number, number> = {};
      palette.forEach((ch) => (counts[ch] = 0));
      for (const n of adj[pick]) if (color[n] != null) counts[color[n]]++;
      chosen = palette.reduce((a, b) => (counts[a] <= counts[b] ? a : b));
    }
    color[pick] = chosen;
    uncolored.delete(pick);
  }
  return color;
}

/** Coverage health score (0-100) + key metrics from an RF result. */
export function coverageMetrics(res: CoverageResult, p: HeatmapProject) {
  const s = res.stats;
  const gaps = s.activeType === 'wifi_ap' ? detectGaps(res, p) : { count: 0, totalAreaFt2: 0, regions: [] };
  const deadPenalty = s.insideCells ? Math.min(1, gaps.totalAreaFt2 / Math.max(1, s.insideCells) / 0.1) : 0;
  const cov = s.pctCovered / 100;
  const qual = Math.max(0, Math.min(1, (s.avgValue - -85) / (-55 - -85)));
  const health = Math.round(100 * (0.6 * cov + 0.25 * qual + 0.15 * (1 - deadPenalty)));
  return { ...s, healthScore: Math.max(0, Math.min(100, health)), deadZones: gaps.count, deadArea: gaps.totalAreaFt2, gaps: gaps.regions.slice(0, 8) };
}

export function recompute(p: HeatmapProject, cellPx = 10, opts: CoverageOpts = {}): CoverageResult {
  const res = computeCoverage(p, cellPx, opts);
  const g = res.stats.deviceCount ? detectGaps(res, p) : { count: 0, totalAreaFt2: 0, regions: [] };
  res.gaps = g.regions;
  res.stats.deadZones = g.count;
  res.stats.deadArea = g.totalAreaFt2;
  if (p.activeType === 'wifi_ap') res.stats.healthScore = coverageMetrics(res, p).healthScore;
  return res;
}
