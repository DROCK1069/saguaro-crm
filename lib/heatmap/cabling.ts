/**
 * Cable-run estimator — per-device home-run footage from the plan geometry to a
 * placed IDF/head-end rack, with the estimating math shown.
 *
 * Standard low-voltage estimating practice, documented so a GC can audit it:
 *   ROUTING_FACTOR 1.3    — cable never runs point-to-point; it follows ceiling
 *                           grid / J-hooks at right angles. 1.25–1.5× straight-line
 *                           is the accepted pre-construction takeoff factor; 1.3 is
 *                           the industry midpoint.
 *   DROP_ALLOWANCE_FT 15  — vertical drops at BOTH ends (rack elevation + device
 *                           drop from the ceiling path) plus in-room routing.
 *   MAX_COPPER_RUN_FT 295 — the 100 m / 328 ft TIA-568 channel minus ~33 ft of
 *                           patch/equipment cords: a pulled run longer than 295 ft
 *                           cannot be certified once patched. Flagged, not hidden.
 *   SERVICE_LOOP_PCT 10   — coiled service loops at each end (industry standard).
 *   WASTE_PCT 5           — box ends, pull mistakes, re-terminations.
 *
 * Pure geometry from the calibrated pxPerFt. Returns null cleanly when the project
 * has no IDF device or no calibrated scale — never a guessed schedule.
 */
import { dist } from './geometry';
import type { Device, DeviceTypeId, HeatmapProject } from './types';
import { DEVICE_CABLING, recommendCabling, type CableRecommendation } from './cabling-spec';

export const ROUTING_FACTOR = 1.3;
export const DROP_ALLOWANCE_FT = 15;
export const MAX_COPPER_RUN_FT = 295;
export const SERVICE_LOOP_PCT = 10;
export const WASTE_PCT = 5;

export interface IdfCableRun {
  deviceId: string;
  typeId: DeviceTypeId;
  label: string;
  /** straight-line device → IDF distance (ft, 0.1 precision) */
  straightFt: number;
  /** estimated pulled length: ceil(straightFt × ROUTING_FACTOR + DROP_ALLOWANCE_FT) */
  runFt: number;
  /** TIA/NEC cable pick for this device at this length (cabling-spec.ts rules) */
  rec: CableRecommendation;
  /** runFt > MAX_COPPER_RUN_FT — needs fiber, an extender, or a closer IDF */
  overLimit: boolean;
}

export interface CableRunTotals {
  runCount: number;
  /** Σ runFt over all runs */
  totalRunFt: number;
  /** ceil(totalRunFt × SERVICE_LOOP_PCT%) */
  serviceLoopFt: number;
  /** ceil(totalRunFt × WASTE_PCT%) */
  wasteFt: number;
  /** totalRunFt + serviceLoopFt + wasteFt — the footage to ORDER */
  orderFt: number;
}

export interface CableRunReport {
  idfId: string;
  idfLabel: string;
  runs: IdfCableRun[];
  totals: CableRunTotals;
  /** one line per over-limit run, numbers included */
  flags: string[];
  /** the documented estimating constants, echoed so every report is self-explaining */
  constants: {
    routingFactor: number; dropAllowanceFt: number; maxCopperRunFt: number;
    serviceLoopPct: number; wastePct: number;
  };
}

/** Wall-plate drops with no DEVICE_CABLING entry that are still real home-runs. */
const STATION_DROP_TYPES = new Set<DeviceTypeId>(['data_jack', 'voice_jack', 'combo_plate']);

/** Does this device type get a cable run back to the IDF?
 *  Powered/network devices (anything cabling-spec assigns a data or power cable)
 *  plus station-plate drops. Excluded: the IDF itself, line-voltage outlets
 *  (electrician's scope) and bare termination markers (an end, not a drop). */
export function isRunWorthy(typeId: DeviceTypeId): boolean {
  if (typeId === 'idf') return false;
  if (STATION_DROP_TYPES.has(typeId)) return true;
  const c = DEVICE_CABLING[typeId];
  return !!c && (c.dataCable != null || c.powerCable != null);
}

/**
 * Compute the per-device cable runs from every powered/network device to the IDF.
 * `idfDeviceId` names the rack; omit it to use the first device of type 'idf'.
 * Returns null when there is no IDF device on the plan or no calibrated scale.
 */
export function computeCableRuns(p: HeatmapProject, idfDeviceId?: string): CableRunReport | null {
  const pxPerFt = p.scale?.pxPerFt ?? 0;
  if (!(pxPerFt > 0)) return null;
  const idf: Device | undefined = idfDeviceId
    ? p.devices.find((d) => d.id === idfDeviceId)
    : p.devices.find((d) => d.typeId === 'idf');
  if (!idf) return null;

  const runs: IdfCableRun[] = [];
  const flags: string[] = [];
  for (const d of p.devices) {
    if (d.id === idf.id || !isRunWorthy(d.typeId)) continue;
    const straightRaw = dist(d.pos, idf.pos) / pxPerFt;
    const straightFt = Math.round(straightRaw * 10) / 10;
    const runFt = Math.ceil(straightRaw * ROUTING_FACTOR + DROP_ALLOWANCE_FT);
    const rec = recommendCabling(d.typeId, { distanceFt: runFt });
    const overLimit = runFt > MAX_COPPER_RUN_FT;
    const label = d.label || d.typeId;
    if (overLimit) {
      flags.push(
        `${label}: ${runFt} ft run (${straightFt} ft straight × ${ROUTING_FACTOR} + ${DROP_ALLOWANCE_FT} ft drops) exceeds ` +
        `${MAX_COPPER_RUN_FT} ft — the 328 ft (100 m) copper channel minus patch allowance. Use fiber or place an IDF closer.`,
      );
    }
    runs.push({ deviceId: d.id, typeId: d.typeId, label, straightFt, runFt, rec, overLimit });
  }

  const totalRunFt = runs.reduce((s, r) => s + r.runFt, 0);
  const serviceLoopFt = Math.ceil((totalRunFt * SERVICE_LOOP_PCT) / 100);
  const wasteFt = Math.ceil((totalRunFt * WASTE_PCT) / 100);
  const totals: CableRunTotals = {
    runCount: runs.length,
    totalRunFt,
    serviceLoopFt,
    wasteFt,
    orderFt: totalRunFt + serviceLoopFt + wasteFt,
  };
  return {
    idfId: idf.id,
    idfLabel: idf.label || 'IDF',
    runs,
    totals,
    flags,
    constants: {
      routingFactor: ROUTING_FACTOR, dropAllowanceFt: DROP_ALLOWANCE_FT,
      maxCopperRunFt: MAX_COPPER_RUN_FT, serviceLoopPct: SERVICE_LOOP_PCT, wastePct: WASTE_PCT,
    },
  };
}
