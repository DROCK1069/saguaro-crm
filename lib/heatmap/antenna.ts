/**
 * Heatmap engine — ANTENNA RADIATION PATTERNS (audit #15).
 *
 * The base coverage model added a SCALAR antennaGainDbi identically in every
 * direction (an ideal isotropic radiator). Real APs are not isotropic: a ceiling
 * omni is ~uniform in azimuth but nulls toward its mount; a patch/panel or sector
 * antenna concentrates energy toward boresight and is many dB down behind it
 * (front-to-back ratio). This module returns the directional gain OFFSET (<= 0 dB
 * off-boresight) to ADD to the peak gain, so a directional AP actually beams.
 *
 * MATH / CITATIONS
 * ----------------
 * Directional patterns use the standard 3GPP element-pattern (parabolic-in-dB),
 * 3GPP TR 38.901 Table 7.3-1 (identical form in TR 36.814 Annex A.2.1.1):
 *
 *   Horizontal cut:  A_H(φ') = −min[ 12·(φ'/φ_3dB)² , A_max ]   (dB)
 *   Vertical   cut:  A_V(θ') = −min[ 12·(θ'/θ_3dB)² , SLA_v ]   (dB)
 *   Combined  (3D):  A(φ',θ') = −min{ −[A_H(φ') + A_V(θ')] , A_max }   (dB)
 *
 * where φ' = azimuth offset from boresight, θ' = elevation offset from boresight,
 * φ_3dB / θ_3dB = the −3 dB (half-power) beamwidths, A_max = the front-to-back /
 * max-attenuation floor, SLA_v = the elevation side-lobe floor. The coefficient 12
 * is exact: at φ' = φ_3dB/2 the loss is −12·(0.5)² = −3 dB — i.e. the half-power
 * point sits at ±beamwidth/2, which is the definition of the −3 dB beamwidth.
 *
 * The omni ceiling AP is isotropic in azimuth (0 dB ripple — its defining property)
 * with a small few-dB null toward the mount (straight up). Ceiling dipole/collinear
 * elevation cuts peak near the horizon and null toward the mount; modeled here as a
 * sin²-weighted taper (a smooth, monotonic stand-in for the measured omni elevation
 * cut published in enterprise AP antenna references).
 *
 * BYTE-COMPATIBILITY: relativeGainDb('omni', az, 0, …) === 0 for every azimuth, so
 * an omni AP evaluated in the flat (elevation-0) coverage grid adds exactly 0 —
 * reproducing the original isotropic output. Callers that pass no pattern skip this
 * module entirely (see engine.antennaOffsetDb), also adding exactly 0.
 */
import { angleDiff } from './geometry';
import type { AntennaPattern } from './types';

/** Per-pattern parameters for the 3GPP parabolic model. */
interface PatternSpec {
  /** azimuth −3 dB beamwidth (deg) */
  azBeamwidthDeg: number;
  /** elevation −3 dB beamwidth (deg) */
  elBeamwidthDeg: number;
  /** front-to-back / max azimuth attenuation floor (dB, positive magnitude) */
  fbrDb: number;
  /** elevation side-lobe attenuation floor (dB, positive magnitude) */
  slaVDb: number;
}

/**
 * Defaults chosen from typical indoor Wi-Fi antenna datasheets:
 *  - patch:       ~65° panel, FBR ~25 dB (common indoor directional panel).
 *  - directional: narrow high-gain ~30° dish/panel, FBR ~30 dB.
 *  - sector:      wide-azimuth wall sector ~90° az / ~60° el, FBR ~23 dB.
 * φ_3dB / θ_3dB and A_max are the 3GPP model inputs above; magnitudes are
 * representative planning values — override azimuth beamwidth per device via
 * Device.beamwidthDeg (e.g. the task's 30 / 60 / 90° panels).
 */
const PATTERNS: Record<Exclude<AntennaPattern, 'omni'>, PatternSpec> = {
  patch:       { azBeamwidthDeg: 65, elBeamwidthDeg: 65, fbrDb: 25, slaVDb: 20 },
  directional: { azBeamwidthDeg: 30, elBeamwidthDeg: 30, fbrDb: 30, slaVDb: 25 },
  sector:      { azBeamwidthDeg: 90, elBeamwidthDeg: 60, fbrDb: 23, slaVDb: 20 },
};

/** few-dB null straight up toward a ceiling omni's mount (dB, positive magnitude). */
const OMNI_UP_NULL_DB = 6;
/** mild taper straight down under a ceiling omni (dB, positive magnitude). */
const OMNI_DOWN_ROLLOFF_DB = 2;

const DEG = Math.PI / 180;

/** 3GPP horizontal/vertical cut: −min[12·(off/bw)², floor]  (dB, ≤ 0). */
function cutDb(offDeg: number, beamwidthDeg: number, floorDb: number): number {
  const bw = beamwidthDeg > 0 ? beamwidthDeg : 65;
  return -Math.min(12 * (offDeg / bw) ** 2, floorDb);
}

/**
 * Directional gain OFFSET (dB, ALWAYS <= 0) relative to peak (boresight) gain.
 *
 * @param pattern           antenna pattern id
 * @param azimuthDeg        azimuth of the target as seen from the device (0 = east, CCW+)
 * @param elevationDeg      elevation of the target above the horizon (deg; 0 in the flat plan)
 * @param deviceAzimuthDeg  azimuth the antenna boresight points (0 = east, CCW+)
 * @param deviceDowntiltDeg mechanical/electrical downtilt (deg below horizon) of boresight
 * @param beamwidthDeg      optional azimuth −3 dB beamwidth override (deg)
 * @returns the gain to ADD to peak gain (≤ 0 off-boresight, 0 at boresight)
 */
export function relativeGainDb(
  pattern: AntennaPattern,
  azimuthDeg: number,
  elevationDeg: number,
  deviceAzimuthDeg = 0,
  deviceDowntiltDeg = 0,
  beamwidthDeg?: number,
): number {
  if (pattern === 'omni') {
    // Isotropic in azimuth (0 dB ripple). Elevation: peak at horizon, few-dB null
    // toward the mount (up), mild roll-off straight down. sin²-weighted taper.
    const s2 = Math.sin(elevationDeg * DEG) ** 2;
    return elevationDeg >= 0 ? -OMNI_UP_NULL_DB * s2 : -OMNI_DOWN_ROLLOFF_DB * s2;
  }
  const spec = PATTERNS[pattern];
  const azOff = angleDiff(azimuthDeg, deviceAzimuthDeg);               // 0..180
  // boresight elevation = −downtilt; deviation from boresight = elevation + downtilt.
  const elOff = elevationDeg + deviceDowntiltDeg;
  const aH = cutDb(azOff, beamwidthDeg ?? spec.azBeamwidthDeg, spec.fbrDb);
  const aV = cutDb(elOff, spec.elBeamwidthDeg, spec.slaVDb);
  // 3GPP 3D combine, clamped to the front-to-back floor.
  return Math.max(-spec.fbrDb, aH + aV);
}

/** Peak-to-back ratio (dB, positive) a pattern delivers — handy for BOM/spec notes. */
export function frontToBackDb(pattern: AntennaPattern): number {
  return pattern === 'omni' ? 0 : PATTERNS[pattern].fbrDb;
}
