/**
 * Heatmap engine — CAPACITY / THROUGHPUT (audit #16).
 *
 * The base coverage grid was pure RSSI-threshold; it never estimated how much DATA
 * a cell could actually carry, and vendors.ts `streamCount` was consumed NOWHERE.
 * This module turns the per-cell SINR (from the engine's real SINR model) into an
 * 802.11 PHY rate via an MCS table, then rolls per-cell rates up into per-AP and
 * network-aggregate capacity.
 *
 * PHY-RATE MATH / CITATIONS
 * -------------------------
 * 802.11ax (HE) single-stream rate at 20 MHz, from the OFDM rate equation:
 *
 *   R = N_SD · N_BPSCS · R_code · N_SS / T_SYM
 *
 *   N_SD    = data subcarriers = 234 @20 MHz (802.11ax HE)          [IEEE 802.11ax]
 *   N_BPSCS = coded bits/subcarrier/stream: BPSK1 QPSK2 16QAM4 64QAM6 256QAM8 1024QAM10
 *   R_code  = FEC coding rate (1/2 … 5/6)
 *   T_SYM   = 12.8 µs FFT + 0.8 µs GI = 13.6 µs (HE, 0.8 µs guard interval)
 *
 * This reproduces the published HE MCS table exactly (MCS0 @20 MHz 1SS = 8.6 Mbps,
 * MCS7 = 86.0, MCS9 = 114.7, MCS11 = 143.4 Mbps).
 *
 * Wider channels scale by the data-subcarrier ratio (same symbol time): 40 MHz = 468,
 * 80 MHz = 980, 160 MHz = 1960 data subcarriers → ×2.0 / ×4.19 / ×8.38 vs 20 MHz.
 * Spatial streams (NSS) scale linearly (MIMO), sourced from the AP model streamCount.
 *
 * REQUIRED SNR PER MCS (dB): representative minimum-SINR thresholds to sustain each
 * MCS, from 802.11 receiver minimum-sensitivity + implementation margin as tabulated
 * in common WLAN design references (e.g. the widely-cited MCS/SNR index tables and
 * enterprise Wi-Fi design guides). Monotonic and conservative.
 *
 * Additive: this NEVER changes computeCoverage's signature. It reads the SINR and
 * serverId that the coverage cells now carry; existing callers are untouched.
 */
import type { Band, CoverageResult, Device, HeatmapProject } from './types';
import { effectiveWidthMhz } from './engine';
import { findApModel, perBandStreams } from './vendors';

/* ── 802.11 MCS table (HE / 802.11ax) ────────────────────────────────────── */
export interface McsEntry {
  idx: number;
  mod: string;
  coding: number;     // FEC rate
  nbpscs: number;     // coded bits per subcarrier per stream
  reqSnrDb: number;   // minimum SINR to sustain this MCS
}

export const MCS_TABLE: McsEntry[] = [
  { idx: 0,  mod: 'BPSK',     coding: 1 / 2, nbpscs: 1,  reqSnrDb: 2 },
  { idx: 1,  mod: 'QPSK',     coding: 1 / 2, nbpscs: 2,  reqSnrDb: 5 },
  { idx: 2,  mod: 'QPSK',     coding: 3 / 4, nbpscs: 2,  reqSnrDb: 9 },
  { idx: 3,  mod: '16-QAM',   coding: 1 / 2, nbpscs: 4,  reqSnrDb: 11 },
  { idx: 4,  mod: '16-QAM',   coding: 3 / 4, nbpscs: 4,  reqSnrDb: 15 },
  { idx: 5,  mod: '64-QAM',   coding: 2 / 3, nbpscs: 6,  reqSnrDb: 18 },
  { idx: 6,  mod: '64-QAM',   coding: 3 / 4, nbpscs: 6,  reqSnrDb: 20 },
  { idx: 7,  mod: '64-QAM',   coding: 5 / 6, nbpscs: 6,  reqSnrDb: 25 },
  { idx: 8,  mod: '256-QAM',  coding: 3 / 4, nbpscs: 8,  reqSnrDb: 29 },
  { idx: 9,  mod: '256-QAM',  coding: 5 / 6, nbpscs: 8,  reqSnrDb: 31 },
  { idx: 10, mod: '1024-QAM', coding: 3 / 4, nbpscs: 10, reqSnrDb: 34 },
  { idx: 11, mod: '1024-QAM', coding: 5 / 6, nbpscs: 10, reqSnrDb: 37 },
];

/** HE data subcarriers per channel width (IEEE 802.11ax). */
const HE_DATA_SC: Record<number, number> = { 20: 234, 40: 468, 80: 980, 160: 1960 };
/** HE OFDM symbol duration (µs): 12.8 µs FFT + 0.8 µs guard interval. */
const HE_SYMBOL_US = 13.6;

/** Highest MCS whose required SINR is met, or null if even MCS0 can't decode. */
export function mcsForSnr(sinrDb: number): McsEntry | null {
  let best: McsEntry | null = null;
  for (const m of MCS_TABLE) if (sinrDb >= m.reqSnrDb) best = m;
  return best;
}

/** 20 MHz / 1-SS PHY rate (Mbps) for an MCS from the OFDM rate equation. */
export function base20Mbps(m: McsEntry): number {
  // bits per symbol / symbol time; (µs → 1e-6 s) and (bps → 1e-6 Mbps) cancel.
  return (HE_DATA_SC[20] * m.nbpscs * m.coding) / HE_SYMBOL_US;
}

/** Data-subcarrier scaling for a wider channel (same symbol time). */
function widthFactor(widthMhz: number): number {
  return (HE_DATA_SC[widthMhz] ?? HE_DATA_SC[20]) / HE_DATA_SC[20];
}

/** PHY rate (Mbps) for a given SINR, channel width, and spatial-stream count. */
export function phyRateMbps(sinrDb: number, widthMhz: number, nss: number): number {
  const m = mcsForSnr(sinrDb);
  if (!m) return 0;
  return base20Mbps(m) * widthFactor(widthMhz) * Math.max(1, nss);
}

/** Effective spatial streams (NSS) for an AP: explicit → model catalog → default 2 (2×2). */
export function apStreams(dev: Device): number {
  if (dev.spatialStreams != null) return Math.max(1, Math.min(4, dev.spatialStreams));
  if (dev.apModelId) {
    const model = findApModel(dev.apModelId);
    if (model) return perBandStreams(model, (dev.band ?? '5') as Band);
  }
  return 2; // typical effective client/AP MIMO rank when the model isn't specified
}

/* ── Capacity summary ────────────────────────────────────────────────────── */

export interface ApCapacity { id: string; label?: string; mbps: number; cells: number }
export interface CapacityResult {
  /** sum of per-AP mean link rates — network aggregate assuming orthogonal channels. */
  aggregateMbps: number;
  /** per-AP mean achievable PHY rate over the cells that AP serves. */
  perApMbps: ApCapacity[];
  /** mean PHY rate across all covered RF cells. */
  avgMbpsPerCoveredCell: number;
  /** how many clients the aggregate supports at `mbpsPerClient` each. */
  clientCapacityAtRate: (mbpsPerClient: number) => number;
}

/**
 * Estimate network capacity from a computed coverage result.
 * @param project the heatmap project (for per-AP width / NSS lookup)
 * @param cov     a CoverageResult from computeCoverage (RF / wifi_ap)
 *
 * Limitation (honest): aggregateMbps sums per-AP capacity assuming non-overlapping
 * channels (frequency reuse). Overlapping co-channel APs share airtime, so real
 * aggregate is lower — the SINR gate already drops collided cells, but this sum does
 * not further discount contention between same-channel APs.
 */
export function estimateCapacity(project: HeatmapProject, cov: CoverageResult): CapacityResult {
  const active = project.devices.filter((d) => d.typeId === 'wifi_ap');
  const byId = new Map(active.map((d) => [d.id, d] as const));
  const apAcc = new Map<string, { sum: number; n: number }>();
  let cellSum = 0, cellN = 0;

  for (const c of cov.cells) {
    if (!c || !c.covered || c.sinrDb == null || !c.serverId) continue;
    const dev = byId.get(c.serverId);
    if (!dev) continue;
    const rate = phyRateMbps(c.sinrDb, effectiveWidthMhz(dev), apStreams(dev));
    cellSum += rate; cellN++;
    const a = apAcc.get(dev.id) ?? { sum: 0, n: 0 };
    a.sum += rate; a.n++; apAcc.set(dev.id, a);
  }

  const round = (x: number) => Math.round(x * 10) / 10;
  const perApMbps: ApCapacity[] = active.map((d) => {
    const a = apAcc.get(d.id);
    return { id: d.id, label: d.label, mbps: a && a.n ? round(a.sum / a.n) : 0, cells: a?.n ?? 0 };
  });
  const aggregateMbps = round(perApMbps.reduce((s, x) => s + x.mbps, 0));
  const avgMbpsPerCoveredCell = cellN ? round(cellSum / cellN) : 0;

  return {
    aggregateMbps,
    perApMbps,
    avgMbpsPerCoveredCell,
    clientCapacityAtRate: (mbpsPerClient: number) =>
      mbpsPerClient > 0 ? Math.floor(aggregateMbps / mbpsPerClient) : 0,
  };
}
