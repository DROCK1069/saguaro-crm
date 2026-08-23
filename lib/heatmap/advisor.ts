/**
 * Signal Advisor — the reasoned WHY behind a design, with the numbers shown.
 *
 * The owner's complaint: designs show "too many APs with no real report on why
 * and calculations". This module is the answer — every verdict it returns carries
 * the arithmetic that produced it (area ÷ budget → count, spacing vs minimum,
 * DORI distances from resolution + FOV), so a GC can check the math by hand.
 *
 * Pure + DOM-free: same engine on web, iOS, and the report generator. All area
 * figures come from the calibrated scale via smart.deriveFootprint — no guesses.
 */
import type { Pt } from './geometry';
import { dist, pointInPolygon } from './geometry';
import type { Band, Device, DeviceTypeId, Env, HeatmapProject } from './types';
import { DEVICE_REGISTRY, DORI_ZONES, doriDistanceFt } from './models';
import { AI_CAMERA_FT2, AI_SENSOR_FT2, areaPerApFt2, deriveFootprint, minApSeparationFt, type CoverageDensity } from './smart';

/** The density ceiling smart.autoPlaceAPs / gapsWorthFixing enforce: 1 AP / 1,500 ft².
 *  Kept here (same value, same meaning) so UI density flags and the advisor agree
 *  with the placer — sanity.test.ts pins the advisor's cap against the placer's. */
export const HARD_CAP_FT2_PER_AP = 1500;

/** en-US thousands formatting so "2,680 ft²" reads the same on every runtime. */
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const ft1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/* ── Report shapes ─────────────────────────────────────────────────────── */

export type ApVerdict = 'ok' | 'crowded' | 'redundant';
export interface ApReasoning {
  id: string;
  label: string;
  /** floor area this AP actually serves (nearest-AP partition of the footprint), ft² */
  areaServedFt2: number;
  /** distance to the nearest OTHER AP (ft); null when it is the only AP */
  nearestApFt: number | null;
  nearestApId: string | null;
  /** the minimum center-to-center separation the plan's density budget implies (ft) */
  minSepFt: number;
  env: Env;
  band: Band;
  verdict: ApVerdict;
  /** one sentence, numbers included */
  reason: string;
}

export type DensityVerdict = 'ok' | 'crowded' | 'sparse' | 'unknown';
export interface DensityReport {
  apCount: number;
  /** area ÷ areaPerApFt2(env, density) — what the engine would place */
  recommendedCount: number;
  /** absolute ceiling: 1 AP / HARD_CAP_FT2_PER_AP ft² (same as the placer) */
  hardCap: number;
  areaFt2: number;
  perApFt2: number;
  verdict: DensityVerdict;
  /** e.g. "2,680 ft² office / 4,000 ft²-per-AP → 1 AP recommended, hard cap 2 — found 9." */
  explanation: string;
}

export interface CameraReasoning {
  id: string;
  label: string;
  resolutionPx: number;
  hfovDeg: number;
  /** EN 62676-4 DORI distances (ft) from THIS camera's resolution + FOV, 0.75 derated */
  identifyFt: number;
  recognizeFt: number;
  observeFt: number;
  detectFt: number;
  /** explicit rangeFt override on the device, if any */
  claimedRangeFt: number | null;
  /** false when a claimed range exceeds what the optics can actually Detect */
  honest: boolean;
  note: string;
}

export interface TypeCountReport {
  typeId: DeviceTypeId;
  label: string;
  count: number;
  /** area-derived cap: cameras 1 / AI_CAMERA_FT2 ft² (min 2), sensors 1 / AI_SENSOR_FT2 ft² (min 1) */
  cap: number;
  perDeviceFt2: number;
  verdict: 'ok' | 'over';
  note: string;
}

export interface DesignAdvice {
  /** false = no calibrated scale; area-based verdicts are withheld, not guessed */
  scaled: boolean;
  areaFt2: number;
  density: DensityReport;
  perApReasoning: ApReasoning[];
  cameras: CameraReasoning[];
  /** per-type counts vs area caps for sensors / access / cameras (non-AP hardware) */
  typeCounts: TypeCountReport[];
  warnings: string[];
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** DORI pixel densities by label, straight from the models.ts table (px/m). */
function doriPxPerM(label: string): number {
  const z = DORI_ZONES.find((d) => d.label === label);
  return z ? z.pxPerM : 25;
}

function bboxOf(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  return { minX, minY, maxX, maxY };
}

/** Nearest-AP partition of the footprint: sample a ~4 ft interior grid, assign each
 *  sample to its nearest AP, convert the share to ft². Real geometry, not a guess. */
function apServedAreasFt2(poly: Pt[], areaFt2: number, aps: Device[], pxPerFt: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of aps) out.set(a.id, 0);
  if (!aps.length || !(areaFt2 > 0)) return out;
  const b = bboxOf(poly);
  const spacing = Math.max(4, pxPerFt * 4); // ~every 4 ft
  let total = 0;
  const counts = new Map<string, number>();
  for (let y = b.minY + spacing / 2; y < b.maxY; y += spacing) {
    for (let x = b.minX + spacing / 2; x < b.maxX; x += spacing) {
      const q = { x, y };
      if (!pointInPolygon(q, poly)) continue;
      total++;
      let bi = aps[0], bd = Infinity;
      for (const a of aps) { const d = dist(q, a.pos); if (d < bd) { bd = d; bi = a; } }
      counts.set(bi.id, (counts.get(bi.id) ?? 0) + 1);
    }
  }
  if (!total) return out;
  for (const a of aps) out.set(a.id, ((counts.get(a.id) ?? 0) / total) * areaFt2);
  return out;
}

/** Non-AP device types the per-type area caps apply to. Rough-in / rack markers are
 *  annotations (a plate count is a takeoff, not a density question) — excluded. */
const ANNOTATION_TYPES: ReadonlySet<string> = new Set([
  'electrical_outlet', 'data_jack', 'voice_jack', 'combo_plate', 'cable_term', 'idf',
]);

/* ── The advisor ───────────────────────────────────────────────────────── */

export interface AdviseOpts {
  /** density goal the design was built to (matches autoPlaceAPs) — default 'standard' */
  density?: CoverageDensity;
  /** explicit ft²-per-AP override; wins over density/env (matches autoPlaceAPs) */
  areaPerApFt2?: number;
}

/**
 * Full reasoned report for a design: per-AP spacing + served-area verdicts, the
 * density arithmetic (area ÷ budget → recommended, vs hard cap, vs found), camera
 * DORI honesty from each unit's real optics, and per-type sensor/access counts vs
 * area caps. Every sentence carries its numbers.
 */
export function adviseDesign(p: HeatmapProject, opts: AdviseOpts = {}): DesignAdvice {
  const pxPerFt = p.scale?.pxPerFt ?? 0;
  const scaled = pxPerFt > 0;
  const { poly, areaFt2 } = deriveFootprint(p);
  const aps = p.devices.filter((d) => d.typeId === 'wifi_ap');
  const perAp = opts.areaPerApFt2 ?? areaPerApFt2(p.env, opts.density ?? 'standard');
  const minSepFt = minApSeparationFt(perAp);
  const warnings: string[] = [];

  /* ── Density: the count arithmetic, shown ── */
  const recommendedCount = areaFt2 > 0 ? Math.max(1, Math.ceil(areaFt2 / perAp)) : 0;
  const hardCap = areaFt2 > 0 ? Math.max(1, Math.ceil(areaFt2 / HARD_CAP_FT2_PER_AP)) : 0;
  let dVerdict: DensityVerdict;
  let explanation: string;
  if (!scaled || !(areaFt2 > 0)) {
    dVerdict = 'unknown';
    explanation = 'No calibrated scale — floor area is unknown, so AP density cannot be judged. Calibrate the plan (set px/ft) first.';
    warnings.push(explanation);
  } else {
    dVerdict = aps.length > hardCap ? 'crowded' : aps.length < recommendedCount ? 'sparse' : 'ok';
    explanation =
      `${fmt(areaFt2)} ft² ${p.env} / ${fmt(perAp)} ft²-per-AP → ${recommendedCount} AP${recommendedCount === 1 ? '' : 's'} recommended, ` +
      `hard cap ${hardCap} (1 AP / ${fmt(HARD_CAP_FT2_PER_AP)} ft²) — found ${aps.length}.`;
    if (dVerdict === 'crowded') warnings.push(`Too many APs: ${explanation}`);
    if (dVerdict === 'sparse' && aps.length > 0) warnings.push(`Under-covered: ${explanation}`);
  }
  const density: DensityReport = { apCount: aps.length, recommendedCount, hardCap, areaFt2, perApFt2: perAp, verdict: dVerdict, explanation };

  /* ── Per-AP reasoning: served area (nearest-AP partition) + spacing vs minimum ── */
  const served = scaled ? apServedAreasFt2(poly, areaFt2, aps, pxPerFt) : new Map<string, number>();
  const perApReasoning: ApReasoning[] = aps.map((a) => {
    const label = a.label || `AP ${a.id.slice(-4)}`;
    const band = (a.band ?? '5') as Band;
    let nearestApFt: number | null = null;
    let nearestApId: string | null = null;
    for (const o of aps) {
      if (o.id === a.id) continue;
      const dFt = scaled ? dist(a.pos, o.pos) / pxPerFt : dist(a.pos, o.pos);
      if (nearestApFt == null || dFt < nearestApFt) { nearestApFt = dFt; nearestApId = o.id; }
    }
    const areaServedFt2 = served.get(a.id) ?? 0;
    let verdict: ApVerdict = 'ok';
    let reason: string;
    if (!scaled) {
      reason = `${label}: plan is uncalibrated — spacing and served area cannot be computed.`;
    } else if (nearestApFt != null && nearestApFt < minSepFt) {
      verdict = 'redundant';
      reason = `${label}: ${ft1(nearestApFt)} ft from its nearest AP — under the ${ft1(minSepFt)} ft minimum separation a ${fmt(perAp)} ft²-per-AP plan implies. This radio adds co-channel interference, not coverage.`;
    } else if (aps.length > 1 && areaServedFt2 < 0.5 * perAp) {
      verdict = 'crowded';
      reason = `${label}: serves ${fmt(areaServedFt2)} ft² — well under the ${fmt(perAp)} ft² one AP is budgeted to cover (nearest AP ${nearestApFt != null ? ft1(nearestApFt) : '—'} ft).`;
    } else {
      reason = nearestApFt != null
        ? `${label}: serves ${fmt(areaServedFt2)} ft²; nearest AP ${ft1(nearestApFt)} ft away (≥ ${ft1(minSepFt)} ft minimum). Band ${band} GHz.`
        : `${label}: only AP on the floor — serves the full ${fmt(areaServedFt2)} ft². Band ${band} GHz.`;
    }
    return { id: a.id, label, areaServedFt2, nearestApFt, nearestApId, minSepFt, env: p.env, band, verdict, reason };
  });
  const redundant = perApReasoning.filter((r) => r.verdict === 'redundant').length;
  if (redundant) warnings.push(`${redundant} AP${redundant === 1 ? '' : 's'} sit under the ${ft1(minSepFt)} ft minimum separation — remove or respace them.`);

  /* ── Cameras: DORI distances from EACH unit's real optics (EN 62676-4, 0.75 derate) ── */
  const cameras: CameraReasoning[] = p.devices.filter((d) => d.typeId === 'camera').map((c) => {
    const def = DEVICE_REGISTRY.camera;
    const resolutionPx = c.resolutionPx ?? (def.defaults.resolutionPx as number);
    const hfovDeg = c.hfovDeg ?? (def.defaults.hfovDeg as number);
    const identifyFt = doriDistanceFt(resolutionPx, hfovDeg, doriPxPerM('Identify'));
    const recognizeFt = doriDistanceFt(resolutionPx, hfovDeg, doriPxPerM('Recognize'));
    const observeFt = doriDistanceFt(resolutionPx, hfovDeg, doriPxPerM('Observe'));
    const detectFt = doriDistanceFt(resolutionPx, hfovDeg, doriPxPerM('Detect'));
    const claimedRangeFt = c.rangeFt ?? null;
    const honest = claimedRangeFt == null || claimedRangeFt <= detectFt;
    const label = c.label || `Camera ${c.id.slice(-4)}`;
    let note =
      `${label}: ${fmt(resolutionPx)} px @ ${hfovDeg}° → Identify to ${ft1(identifyFt)} ft, Recognize ${ft1(recognizeFt)} ft, Observe ${ft1(observeFt)} ft, Detect ${ft1(detectFt)} ft (EN 62676-4, 0.75 field derate).`;
    if (!honest && claimedRangeFt != null) {
      note += ` Claimed range ${ft1(claimedRangeFt)} ft EXCEEDS the ${ft1(detectFt)} ft Detect limit of these optics — the extra ${ft1(claimedRangeFt - detectFt)} ft is not real coverage.`;
      warnings.push(`${label} claims ${ft1(claimedRangeFt)} ft of range but its optics Detect to only ${ft1(detectFt)} ft.`);
    }
    return { id: c.id, label, resolutionPx, hfovDeg, identifyFt, recognizeFt, observeFt, detectFt, claimedRangeFt, honest, note };
  });

  /* ── Sensors / access / cameras: per-type counts vs area caps ── */
  const byType = new Map<DeviceTypeId, number>();
  for (const d of p.devices) {
    if (d.typeId === 'wifi_ap' || ANNOTATION_TYPES.has(d.typeId)) continue;
    byType.set(d.typeId, (byType.get(d.typeId) ?? 0) + 1);
  }
  const typeCounts: TypeCountReport[] = [...byType.entries()].map(([typeId, count]) => {
    const label = DEVICE_REGISTRY[typeId].label;
    const perDeviceFt2 = typeId === 'camera' ? AI_CAMERA_FT2 : AI_SENSOR_FT2;
    const cap = areaFt2 > 0
      ? (typeId === 'camera' ? Math.max(2, Math.ceil(areaFt2 / AI_CAMERA_FT2)) : Math.max(1, Math.ceil(areaFt2 / AI_SENSOR_FT2)))
      : count; // unscaled → no area cap can be computed; report the count honestly
    const verdict: 'ok' | 'over' = count > cap ? 'over' : 'ok';
    const note = areaFt2 > 0
      ? `${count}× ${label} on ${fmt(areaFt2)} ft² — 1 per ${fmt(perDeviceFt2)} ft² caps this floor at ${cap}.${verdict === 'over' ? ` ${count - cap} over.` : ''}`
      : `${count}× ${label} — no calibrated scale, so no area cap can be computed.`;
    if (verdict === 'over') warnings.push(note);
    return { typeId, label, count, cap, perDeviceFt2, verdict, note };
  }).sort((a, b) => b.count - a.count);

  return { scaled, areaFt2, density, perApReasoning, cameras, typeCounts, warnings };
}

/* ── Load-time density guard ───────────────────────────────────────────── */

export interface DensityFlag {
  apCount: number;
  hardCap: number;
  areaFt2: number;
  /** one sentence, numbers included — ready to toast/banner on project load */
  message: string;
}

/**
 * Cheap guard a UI can run ON LOAD: counts ALL wifi_ap devices — legacy designs
 * placed before the density work carry no autoPlaced flag, so everything counts —
 * against the same 1 AP / 1,500 ft² hard cap the placer enforces. Returns null
 * when the design is fine, unscaled (no honest area → no verdict), or has no APs.
 */
export function designDensityFlag(p: HeatmapProject): DensityFlag | null {
  const apCount = p.devices.filter((d) => d.typeId === 'wifi_ap').length;
  if (!apCount) return null;
  const { areaFt2 } = deriveFootprint(p);
  if (!(areaFt2 > 0)) return null;
  const hardCap = Math.max(1, Math.ceil(areaFt2 / HARD_CAP_FT2_PER_AP));
  if (apCount <= hardCap) return null;
  return {
    apCount, hardCap, areaFt2,
    message: `${apCount} APs on ${fmt(areaFt2)} ft² — the density ceiling for this floor is ${hardCap} (1 AP / ${fmt(HARD_CAP_FT2_PER_AP)} ft²). Re-run auto-design or remove ${apCount - hardCap}.`,
  };
}
