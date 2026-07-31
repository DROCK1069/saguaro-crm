/**
 * Heatmap engine — provenance + survey helpers (deterministic, no Date.now/Math.random).
 *
 * Small shared utilities used by BOTH the editor report and the client share page so
 * the two surfaces can never disagree:
 *  - RF_ENGINE_VERSION / CATALOG_VERSION + a design hash → stamp every deliverable
 *  - parseSurveyCsv → bulk walk-test import (feeds calibrate.ts)
 *  - calibrationNote / medianAbsErrorDb → turn a CalibrationResult into a defensible,
 *    validated-uncertainty line ("±4.8 dB over 46 survey points") instead of a static ±6 dB.
 */
import type { HeatmapProject, MeasuredPoint } from './types';
import type { CalibrationResult } from './calibrate';

/** Bump when the propagation/rollup math changes in a way that alters results. */
export const RF_ENGINE_VERSION = '2.1';
/** Device/vendor + cost catalog revision (lib/heatmap/vendors, models). */
export const CATALOG_VERSION = '2026.7';

/** Cheap, order-independent-per-field deterministic hash of the design inputs (short hex). */
export function designHash(project: HeatmapProject | null | undefined): string {
  if (!project) return '00000000';
  const parts: string[] = [
    `env:${project.env}`,
    `scale:${project.scale ? project.scale.pxPerFt.toFixed(3) : 'none'}`,
    `img:${project.imgW}x${project.imgH}`,
    `tgt:${project.rssiTargetDbm}`,
  ];
  for (const d of project.devices) {
    parts.push(`d:${d.id}:${d.typeId}:${Math.round(d.pos.x)},${Math.round(d.pos.y)}:${d.band ?? ''}:${d.channel ?? ''}:${d.txPowerDbm ?? ''}`);
  }
  for (const w of project.walls) parts.push(`w:${w.id}:${w.material}`);
  const s = parts.join('|');
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** One-line provenance footer for reports/shares. */
export function engineStamp(project: HeatmapProject | null | undefined): string {
  return `RF engine v${RF_ENGINE_VERSION} · catalog v${CATALOG_VERSION} · design #${designHash(project)}`;
}

/** Median of |predicted − measured| across the fit's residuals (dB). */
export function medianAbsErrorDb(cal: CalibrationResult | null | undefined): number | null {
  if (!cal || !cal.residuals.length) return null;
  const abs = cal.residuals.map((r) => Math.abs(r.delta)).sort((a, b) => a - b);
  const mid = Math.floor(abs.length / 2);
  return abs.length % 2 ? abs[mid] : (abs[mid - 1] + abs[mid]) / 2;
}

/**
 * The design's accuracy claim. With a real survey it becomes a defensible, validated
 * number; without one it falls back to the honest predictive-model disclaimer.
 */
export function calibrationNote(cal: CalibrationResult | null | undefined): string {
  if (cal && cal.sampleCount > 0) {
    const med = medianAbsErrorDb(cal);
    const medTxt = med != null ? `, median abs error ${med.toFixed(1)} dB` : '';
    const better = cal.improvedPct > 0 ? `, ${cal.improvedPct.toFixed(0)}% tighter than the book model` : '';
    const pts = `${cal.sampleCount} on-site survey point${cal.sampleCount === 1 ? '' : 's'}`;
    return `Validated against ${pts} — model accuracy ±${cal.rmseAfter.toFixed(1)} dB${medTxt}${better}.`;
  }
  return 'Predictive design — Ekahau/Hamina-class RF model (±6 dB without an on-site survey).';
}

/**
 * Parse a walk-test CSV into survey points. Coordinates are floor-plan IMAGE PIXELS
 * (same space as the manual survey entry). Flexible header detection; falls back to
 * positional x,y,dBm[,servingApId]. Rejects non-numeric / physically-absurd rows.
 */
export function parseSurveyCsv(text: string): { points: MeasuredPoint[]; skipped: number } {
  const points: MeasuredPoint[] = [];
  let skipped = 0;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { points, skipped };

  let start = 0;
  let ix = 0, iy = 1, idbm = 2, iap = -1;
  const first = lines[0].split(/[,;\t]/).map((c) => c.trim());
  const headerish = first.some((c) => /[a-zA-Z]/.test(c) && !Number.isFinite(Number(c)));
  if (headerish) {
    start = 1;
    const lower = first.map((c) => c.toLowerCase());
    const find = (...names: string[]) => { for (const n of names) { const i = lower.indexOf(n); if (i >= 0) return i; } return -1; };
    const xi = find('x', 'px', 'imgx', 'plan_x', 'planx');
    const yi = find('y', 'py', 'imgy', 'plan_y', 'plany');
    const di = find('dbm', 'measureddbm', 'measured_dbm', 'rssi', 'rssidbm', 'signal', 'measured');
    const ai = find('ap', 'servingap', 'servingapid', 'serving_ap_id', 'apid', 'ap_id');
    ix = xi >= 0 ? xi : 0; iy = yi >= 0 ? yi : 1; idbm = di >= 0 ? di : 2; iap = ai;
  }

  for (let i = start; i < lines.length; i++) {
    const c = lines[i].split(/[,;\t]/).map((s) => s.trim());
    const x = Number(c[ix]); const y = Number(c[iy]); const dbm = Number(c[idbm]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dbm)) { skipped++; continue; }
    if (dbm > -10 || dbm < -120) { skipped++; continue; } // RSSI must be a sane negative dBm
    const mp: MeasuredPoint = { x, y, measuredDbm: Math.round(dbm) };
    if (iap >= 0 && c[iap]) mp.servingApId = c[iap];
    points.push(mp);
  }
  return { points, skipped };
}
