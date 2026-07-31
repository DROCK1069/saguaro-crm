/**
 * Heatmap engine — SURVEY CALIBRATION.
 *
 * Fits the predictive RF model to real measured points (a manual site survey /
 * walk test) so our predictions validate against reality — the Ekahau edge.
 *
 * Method: least-squares over the log-distance path-loss exponent `n`
 * (and, when walls are in play, a global wall-loss scale) to minimize the RMSE
 * between predicted and measured dBm at each surveyed point. Deterministic
 * grid-search (coarse pass in n∈[2.0,4.0] step 0.05, then a fine refine); no
 * Date.now / Math.random anywhere in the logic.
 *
 * Reuses the engine's validated path-loss constants and wall-attenuation math
 * (REF_LOSS_1M, wallDb, crossings, FT_PER_M) — only the exponent, which is the
 * fit variable, is generalized out of the fixed PATH_LOSS_EXP[env] lookup.
 *
 * Coordinates are floor-plan IMAGE PIXELS (same as the rest of the engine).
 */
import type { Pt } from './geometry';
import { dist, crossings } from './geometry';
import type { Band, Device, Env, HeatmapProject, MeasuredPoint } from './types';

// MeasuredPoint now lives on the shared project type so it can persist with the
// design; re-exported here so existing `import { MeasuredPoint } from './calibrate'` keeps working.
export type { MeasuredPoint } from './types';
import {
  FT_PER_M, REF_LOSS_1M, PATH_LOSS_EXP, RF_TX_DEFAULT_DBM, RF_GAIN_DEFAULT_DBI, wallDb,
} from './models';

const log10 = (x: number) => Math.log(x) / Math.LN10;

/* ── Search grid (deterministic) ─────────────────────────────────────────── */
const N_MIN = 2.0;
const N_MAX = 4.0;
const N_STEP_COARSE = 0.05;
const N_STEP_FINE = 0.01;
const WS_MIN = 0.5;
const WS_MAX = 1.5;
const WS_STEP_COARSE = 0.1;
const WS_STEP_FINE = 0.02;

export interface Residual {
  point: Pt;
  predicted: number;
  measured: number;
  /** predicted − measured (dB); positive ⇒ model over-predicts signal here */
  delta: number;
}

export interface CalibrationResult {
  /** exponent the project used before calibration (PATH_LOSS_EXP[env]) */
  nBefore: number;
  /** fitted path-loss exponent */
  nAfter: number;
  /** RMSE (dB) with the pre-calibration model (nBefore, wallScale=1) */
  rmseBefore: number;
  /** RMSE (dB) with the fitted model */
  rmseAfter: number;
  /** fitted global wall-loss multiplier (1 = unchanged; only fit when walls matter) */
  wallScale: number;
  /** per-point residuals at the fitted model */
  residuals: Residual[];
  /** % RMSE reduction: (rmseBefore − rmseAfter) / rmseBefore × 100 */
  improvedPct: number;
  /** number of usable survey points that entered the fit */
  sampleCount: number;
}

/* ── Prediction (path-loss reused from the engine, exponent generalized) ──── */

/** Predicted RSSI (dBm) at `point` from a single AP, given exponent n and wall scale. */
function predictFromAp(point: Pt, ap: Device, p: HeatmapProject, n: number, wallScale: number): number {
  const pxPerFt = p.scale!.pxPerFt;
  const dM = Math.max(dist(point, ap.pos) / pxPerFt / FT_PER_M, 1);
  const band = (ap.band || '5') as Band;
  const pl = REF_LOSS_1M[band] + 10 * n * log10(dM);
  const tx = (ap.txPowerDbm ?? RF_TX_DEFAULT_DBM) + (ap.antennaGainDbi ?? RF_GAIN_DEFAULT_DBI);
  let wall = 0;
  for (const w of crossings(point, ap.pos, p.walls)) wall += wallDb(w.material, band);
  return tx - pl - wallScale * wall;
}

/**
 * Predicted RSSI (dBm) a client would observe at `mp`: the strongest AP (best
 * server), unless the survey pinned a specific serving AP. Returns null if there
 * is no candidate AP. `apById` is a lookup over the eligible APs.
 */
function predictAt(
  mp: MeasuredPoint, aps: Device[], apById: Map<string, Device>, p: HeatmapProject, n: number, wallScale: number,
): number | null {
  const point: Pt = { x: mp.x, y: mp.y };
  if (mp.servingApId) {
    const ap = apById.get(mp.servingApId);
    if (ap) return predictFromAp(point, ap, p, n, wallScale);
    // pinned AP not found → fall through to best-server
  }
  let best = -Infinity;
  for (const ap of aps) {
    const v = predictFromAp(point, ap, p, n, wallScale);
    if (v > best) best = v;
  }
  return best === -Infinity ? null : best;
}

/** RMSE (dB) between predicted and measured over all usable points at (n, wallScale). */
function rmseAt(
  pts: MeasuredPoint[], aps: Device[], apById: Map<string, Device>, p: HeatmapProject, n: number, wallScale: number,
): number {
  let sumSq = 0;
  let count = 0;
  for (const mp of pts) {
    const pred = predictAt(mp, aps, apById, p, n, wallScale);
    if (pred == null) continue;
    const e = pred - mp.measuredDbm;
    sumSq += e * e;
    count++;
  }
  return count ? Math.sqrt(sumSq / count) : 0;
}

/* ── Fit ─────────────────────────────────────────────────────────────────── */

/**
 * Fit the log-distance model to measured survey points by minimizing RMSE.
 * Grid-search over n (and a wall-loss scale when walls influence the readings),
 * then a fine refine around the coarse optimum. Fully deterministic.
 */
export function calibrateModel(project: HeatmapProject, measuredPoints: MeasuredPoint[]): CalibrationResult {
  const nBefore = PATH_LOSS_EXP[project.env];
  const aps = project.devices.filter((d) => d.typeId === 'wifi_ap');
  const apById = new Map<string, Device>();
  for (const ap of aps) apById.set(ap.id, ap);

  // Only points that resolve to at least one predicting AP are usable.
  const usable = measuredPoints.filter(
    (mp) => Number.isFinite(mp.measuredDbm) && predictAt(mp, aps, apById, project, nBefore, 1) != null,
  );

  const rmseBefore = rmseAt(usable, aps, apById, project, nBefore, 1);

  // Does wall attenuation actually influence any surveyed reading? If not, keep
  // wallScale pinned at 1 (unidentifiable → don't pretend to fit it).
  let wallsMatter = false;
  if (project.walls.length) {
    for (const mp of usable) {
      const point: Pt = { x: mp.x, y: mp.y };
      const pinned = mp.servingApId ? apById.get(mp.servingApId) : undefined;
      const candidates = pinned ? [pinned] : aps;
      for (const ap of candidates) {
        if (crossings(point, ap.pos, project.walls).length > 0) { wallsMatter = true; break; }
      }
      if (wallsMatter) break;
    }
  }

  // Degenerate: nothing to fit against → identity result.
  if (!usable.length || !aps.length) {
    return {
      nBefore, nAfter: nBefore, rmseBefore, rmseAfter: rmseBefore, wallScale: 1,
      residuals: [], improvedPct: 0, sampleCount: usable.length,
    };
  }

  const wsGridCoarse = wallsMatter ? gridValues(WS_MIN, WS_MAX, WS_STEP_COARSE) : [1];

  // Coarse pass. Strict-less-than keeps the smallest (n, wallScale) on ties → deterministic.
  let bestN = nBefore;
  let bestWs = 1;
  let bestRmse = Infinity;
  for (const n of gridValues(N_MIN, N_MAX, N_STEP_COARSE)) {
    for (const ws of wsGridCoarse) {
      const r = rmseAt(usable, aps, apById, project, n, ws);
      if (r < bestRmse) { bestRmse = r; bestN = n; bestWs = ws; }
    }
  }

  // Fine refine around the coarse optimum (clamped to the search bounds).
  const nLo = Math.max(N_MIN, bestN - N_STEP_COARSE);
  const nHi = Math.min(N_MAX, bestN + N_STEP_COARSE);
  const wsGridFine = wallsMatter
    ? gridValues(Math.max(WS_MIN, bestWs - WS_STEP_COARSE), Math.min(WS_MAX, bestWs + WS_STEP_COARSE), WS_STEP_FINE)
    : [1];
  for (const n of gridValues(nLo, nHi, N_STEP_FINE)) {
    for (const ws of wsGridFine) {
      const r = rmseAt(usable, aps, apById, project, n, ws);
      if (r < bestRmse) { bestRmse = r; bestN = n; bestWs = ws; }
    }
  }

  const nAfter = round2(bestN);
  const wallScale = round2(bestWs);
  const rmseAfter = rmseAt(usable, aps, apById, project, nAfter, wallScale);

  const residuals: Residual[] = usable.map((mp) => {
    const predicted = predictAt(mp, aps, apById, project, nAfter, wallScale)!;
    return { point: { x: mp.x, y: mp.y }, predicted, measured: mp.measuredDbm, delta: predicted - mp.measuredDbm };
  });

  const improvedPct = rmseBefore > 0 ? ((rmseBefore - rmseAfter) / rmseBefore) * 100 : 0;

  return {
    nBefore, nAfter, rmseBefore, rmseAfter, wallScale, residuals, improvedPct, sampleCount: usable.length,
  };
}

/**
 * Return a copy of the project whose environment reflects the fitted exponent.
 * `env` is a discrete enum, so we snap to the environment whose canonical
 * PATH_LOSS_EXP is nearest the fitted nAfter. The precise fitted exponent is
 * carried on the returned CalibrationResult for callers that need exactness.
 */
export function applyCalibration(project: HeatmapProject, cal: CalibrationResult): HeatmapProject {
  let bestEnv: Env = project.env;
  let bestDelta = Infinity;
  for (const env of Object.keys(PATH_LOSS_EXP) as Env[]) {
    const d = Math.abs(PATH_LOSS_EXP[env] - cal.nAfter);
    if (d < bestDelta) { bestDelta = d; bestEnv = env; }
  }
  return { ...project, env: bestEnv };
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Inclusive value grid [lo, hi] at `step`, built off integer indices (no float drift). */
function gridValues(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const steps = Math.round((hi - lo) / step);
  for (let i = 0; i <= steps; i++) out.push(round4(lo + i * step));
  return out;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10000) / 10000;
