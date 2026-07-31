/**
 * Heatmap engine — MULTI-VENDOR access-point catalog.
 *
 * Beats UniFi-only planners by carrying model-accurate radio specs for every major
 * enterprise/prosumer WiFi vendor, so coverage math + PoE/BOM budgets are real per model.
 *
 * Specs sourced from published vendor datasheets/tech-specs (2026-07). Values are the
 * conducted max TX power (dBm) per band, published antenna gain (dBi), typical PoE draw
 * (W, not the class ceiling), total spatial-stream count, and USD list. Numbers are
 * realistic/representative — edit per placement/datasheet as needed.
 *
 * Reuses the engine's path-loss constants (REF_LOSS_1M / PATH_LOSS_EXP / FT_PER_M) so the
 * per-model range estimate uses the SAME log-distance model as the coverage grid — no
 * duplicated RF math.
 */
import type { Band, Env } from './types';
import { REF_LOSS_1M, PATH_LOSS_EXP, FT_PER_M } from './models';

export type WifiGen = 'wifi5' | 'wifi6' | 'wifi6e' | 'wifi7';

export interface ApModel {
  /** stable slug id (vendor-model), used by findApModel */
  id: string;
  vendor: string;
  model: string;
  wifiGen: WifiGen;
  /** bands the radio supports (subset of the engine Band union) */
  bands: Band[];
  /** conducted max TX power (dBm) per supported band */
  maxTxPowerDbm: Partial<Record<Band, number>>;
  /** published peak antenna gain (dBi) */
  antennaGainDbi: number;
  /** typical PoE power draw (W) — size switch budgets on this, not the 802.3 class ceiling */
  poeWatts: number;
  /** total spatial streams across all radios */
  streamCount: number;
  listPriceUsd: number;
  outdoor: boolean;
  note: string;
}

/** Radio inputs shaped for the engine's AP model (Device.band / txPowerDbm / antennaGainDbi). */
export interface DeviceRadio { txPowerDbm: number; antennaGainDbi: number; band: Band }

/* ── Catalog ──────────────────────────────────────────────────────────────── */

export const VENDOR_CATALOG: ApModel[] = [
  /* ── Ubiquiti UniFi ── */
  { id: 'unifi-u6-lite', vendor: 'Ubiquiti UniFi', model: 'U6 Lite', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 23, '5': 23 }, antennaGainDbi: 3,
    poeWatts: 9.5, streamCount: 4, listPriceUsd: 99, outdoor: false,
    note: '2x2 both bands. 802.3af. Indoor ceiling/wall entry AP.' },
  { id: 'unifi-u6-pro', vendor: 'Ubiquiti UniFi', model: 'U6 Pro', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 22, '5': 26 }, antennaGainDbi: 6,
    poeWatts: 13, streamCount: 6, listPriceUsd: 159, outdoor: false,
    note: '2x2 (2.4) / 4x4 (5). 802.3at. Workhorse indoor AP.' },
  { id: 'unifi-u6-enterprise', vendor: 'Ubiquiti UniFi', model: 'U6 Enterprise', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 22, '5': 26, '6': 26 }, antennaGainDbi: 6,
    poeWatts: 22, streamCount: 12, listPriceUsd: 279, outdoor: false,
    note: 'Tri-band 4x4 all bands (WiFi 6E). 802.3at. Needs 2.5GbE uplink.' },
  { id: 'unifi-u7-pro', vendor: 'Ubiquiti UniFi', model: 'U7 Pro', wifiGen: 'wifi7',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 23, '5': 26, '6': 23 }, antennaGainDbi: 6,
    poeWatts: 13, streamCount: 6, listPriceUsd: 189, outdoor: false,
    note: 'Tri-band WiFi 7, 320MHz on 6GHz. 2x2 all bands. 802.3at.' },

  /* ── Cisco Catalyst ── */
  { id: 'cisco-catalyst-9130axi', vendor: 'Cisco Catalyst', model: 'Catalyst 9130AXI', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 26, '5': 26 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 8, listPriceUsd: 1499, outdoor: false,
    note: '4x4:4 both bands + flexible radio. 802.3at (full power needs UPOE). Enterprise flagship.' },
  { id: 'cisco-catalyst-9166i', vendor: 'Cisco Catalyst', model: 'Catalyst 9166I (CW9166I)', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 24, '5': 26, '6': 26 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 12, listPriceUsd: 1295, outdoor: false,
    note: 'Tri-band WiFi 6E 4x4. 802.3at/bt. Unified Catalyst/Meraki hardware.' },
  { id: 'cisco-catalyst-9115axi', vendor: 'Cisco Catalyst', model: 'Catalyst 9115AXI', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 23, '5': 23 }, antennaGainDbi: 4,
    poeWatts: 25.5, streamCount: 8, listPriceUsd: 799, outdoor: false,
    note: '4x4:4 both bands. 802.3at. Mid-tier enterprise.' },

  /* ── Cisco Meraki ── */
  { id: 'meraki-mr36', vendor: 'Cisco Meraki', model: 'MR36', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 22, '5': 23 }, antennaGainDbi: 3,
    poeWatts: 15.4, streamCount: 4, listPriceUsd: 715, outdoor: false,
    note: '2x2 both bands. 802.3at. Cloud-managed entry (license required).' },
  { id: 'meraki-mr46', vendor: 'Cisco Meraki', model: 'MR46', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 24, '5': 25 }, antennaGainDbi: 4,
    poeWatts: 25.5, streamCount: 8, listPriceUsd: 1399, outdoor: false,
    note: '4x4:4 both bands + dedicated scanning radio. 802.3at. Cloud-managed.' },
  { id: 'meraki-cw9166', vendor: 'Cisco Meraki', model: 'CW9166I', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 24, '5': 26, '6': 26 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 12, listPriceUsd: 1595, outdoor: false,
    note: 'Tri-band WiFi 6E 4x4. 802.3at/bt. Flagship cloud-managed AP.' },

  /* ── Aruba / HPE ── */
  { id: 'aruba-ap-515', vendor: 'Aruba / HPE', model: 'AP-515', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 24, '5': 24 }, antennaGainDbi: 5,
    poeWatts: 20, streamCount: 8, listPriceUsd: 899, outdoor: false,
    note: '4x4:4 both bands. 802.3at. Campus enterprise AP.' },
  { id: 'aruba-ap-635', vendor: 'Aruba / HPE', model: 'AP-635', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 24, '5': 24, '6': 24 }, antennaGainDbi: 6,
    poeWatts: 21, streamCount: 6, listPriceUsd: 1099, outdoor: false,
    note: 'Tri-band WiFi 6E 2x2 per band. 802.3at. First 6GHz campus AP.' },
  { id: 'aruba-instant-on-ap22', vendor: 'Aruba / HPE', model: 'Instant On AP22', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 23, '5': 23 }, antennaGainDbi: 4,
    poeWatts: 12, streamCount: 4, listPriceUsd: 130, outdoor: false,
    note: '2x2 both bands. 802.3af. SMB / small-business line.' },

  /* ── Ruckus / CommScope ── */
  { id: 'ruckus-r650', vendor: 'Ruckus / CommScope', model: 'R650', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 26, '5': 26 }, antennaGainDbi: 6,
    poeWatts: 15.4, streamCount: 8, listPriceUsd: 899, outdoor: false,
    note: '4x4 (5) / 2x2 (2.4) + BeamFlex adaptive antenna. 802.3at.' },
  { id: 'ruckus-r770', vendor: 'Ruckus / CommScope', model: 'R770', wifiGen: 'wifi7',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 24, '5': 26, '6': 26 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 12, listPriceUsd: 1399, outdoor: false,
    note: 'Tri-band WiFi 7 4x4 + BeamFlex. 802.3at/bt. Flagship.' },
  { id: 'ruckus-t350c', vendor: 'Ruckus / CommScope', model: 'T350c', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 26, '5': 26 }, antennaGainDbi: 6,
    poeWatts: 15, streamCount: 4, listPriceUsd: 799, outdoor: true,
    note: '2x2 outdoor, IP67, BeamFlex. 802.3at. Compact outdoor omni.' },

  /* ── Cambium Networks ── */
  { id: 'cambium-xv2-2', vendor: 'Cambium', model: 'XV2-2', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 24, '5': 24 }, antennaGainDbi: 5,
    poeWatts: 25, streamCount: 4, listPriceUsd: 249, outdoor: false,
    note: '2x2 both bands. 802.3at. Value cloud-managed (cnMaestro).' },
  { id: 'cambium-xv3-8', vendor: 'Cambium', model: 'XV3-8', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 24, '5': 24 }, antennaGainDbi: 6,
    poeWatts: 32, streamCount: 16, listPriceUsd: 699, outdoor: false,
    note: '8x8 software-configurable (dual 5GHz split). 802.3bt. High-density.' },
  { id: 'cambium-xe3-4', vendor: 'Cambium', model: 'XE3-4', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 24, '5': 24, '6': 24 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 12, listPriceUsd: 799, outdoor: false,
    note: 'Tri-band WiFi 6E 4x4. 802.3bt. cnMaestro cloud.' },

  /* ── EnGenius ── */
  { id: 'engenius-ecw220', vendor: 'EnGenius', model: 'ECW220', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 24, '5': 24 }, antennaGainDbi: 4,
    poeWatts: 18, streamCount: 4, listPriceUsd: 179, outdoor: false,
    note: '2x2 both bands. 802.3at. Cloud (ENgenius Cloud) value AP.' },
  { id: 'engenius-ecw230', vendor: 'EnGenius', model: 'ECW230', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 26, '5': 26 }, antennaGainDbi: 5,
    poeWatts: 20, streamCount: 8, listPriceUsd: 279, outdoor: false,
    note: '4x4 both bands. 802.3at. High-throughput cloud AP.' },
  { id: 'engenius-ecw336', vendor: 'EnGenius', model: 'ECW336', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 26, '5': 26, '6': 26 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 12, listPriceUsd: 499, outdoor: false,
    note: 'Tri-band WiFi 6E 4x4. 802.3bt. Flagship cloud AP.' },

  /* ── TP-Link Omada ── */
  { id: 'tplink-eap245', vendor: 'TP-Link Omada', model: 'EAP245', wifiGen: 'wifi5',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 23, '5': 23 }, antennaGainDbi: 4,
    poeWatts: 12.9, streamCount: 6, listPriceUsd: 90, outdoor: false,
    note: '3x3 (5) / 3x3 (2.4) AC1750. 802.3af. Budget managed AP.' },
  { id: 'tplink-eap670', vendor: 'TP-Link Omada', model: 'EAP670', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 23, '5': 23 }, antennaGainDbi: 5,
    poeWatts: 17, streamCount: 6, listPriceUsd: 160, outdoor: false,
    note: '4x4 (5) / 2x2 (2.4) AX5400. 802.3at. Value WiFi 6.' },
  { id: 'tplink-eap772', vendor: 'TP-Link Omada', model: 'EAP772', wifiGen: 'wifi7',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 23, '5': 23, '6': 23 }, antennaGainDbi: 5,
    poeWatts: 25, streamCount: 6, listPriceUsd: 300, outdoor: false,
    note: 'Tri-band WiFi 7 BE9300. 802.3at. Value 6GHz managed AP.' },

  /* ── Netgear ── */
  { id: 'netgear-wax620', vendor: 'Netgear', model: 'WAX620', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 23, '5': 23 }, antennaGainDbi: 5,
    poeWatts: 20, streamCount: 4, listPriceUsd: 200, outdoor: false,
    note: '2x2 both bands AX3600. 802.3at. Insight cloud / standalone.' },
  { id: 'netgear-wax630', vendor: 'Netgear', model: 'WAX630', wifiGen: 'wifi6',
    bands: ['2.4', '5'], maxTxPowerDbm: { '2.4': 24, '5': 24 }, antennaGainDbi: 5,
    poeWatts: 25, streamCount: 8, listPriceUsd: 300, outdoor: false,
    note: '4x4 both bands (tri-radio) AX6000. 802.3at. High density.' },
  { id: 'netgear-wbe750', vendor: 'Netgear', model: 'WBE750', wifiGen: 'wifi7',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 24, '5': 24, '6': 24 }, antennaGainDbi: 6,
    poeWatts: 30, streamCount: 12, listPriceUsd: 600, outdoor: false,
    note: 'Tri-band WiFi 7 BE19000. 802.3bt. Insight-managed flagship.' },

  /* ── Generic / Custom ── */
  { id: 'generic-custom', vendor: 'Generic / Custom', model: 'Custom AP', wifiGen: 'wifi6e',
    bands: ['2.4', '5', '6'], maxTxPowerDbm: { '2.4': 20, '5': 23, '6': 23 }, antennaGainDbi: 3,
    poeWatts: 15, streamCount: 4, listPriceUsd: 0, outdoor: false,
    note: 'Placeholder for an unlisted/other-vendor AP — edit specs to match its datasheet.' },
];

/* ── Lookups ──────────────────────────────────────────────────────────────── */

/** Distinct vendor list, in catalog order (first appearance). */
export const VENDORS: string[] = VENDOR_CATALOG.reduce<string[]>((acc, m) => {
  if (!acc.includes(m.vendor)) acc.push(m.vendor);
  return acc;
}, []);

/** All AP models for one vendor. */
export function apModelsByVendor(vendor: string): ApModel[] {
  return VENDOR_CATALOG.filter((m) => m.vendor === vendor);
}

/** Look up a model by its stable id. */
export function findApModel(id: string): ApModel | undefined {
  return VENDOR_CATALOG.find((m) => m.id === id);
}

/* ── Engine adapter ───────────────────────────────────────────────────────── */

/**
 * Adapt a catalog model + band to the engine's AP radio inputs
 * ({ txPowerDbm, antennaGainDbi, band }, matching Device fields).
 * If the requested band isn't supported, falls back to the model's primary (first) band
 * so the return is always engine-valid.
 */
export function toDeviceRadio(model: ApModel, band: Band): DeviceRadio {
  const effBand: Band = model.bands.includes(band) ? band : model.bands[0];
  const tx = model.maxTxPowerDbm[effBand];
  return {
    txPowerDbm: tx ?? Math.max(...Object.values(model.maxTxPowerDbm) as number[]),
    antennaGainDbi: model.antennaGainDbi,
    band: effBand,
  };
}

/**
 * Per-band (per-radio) spatial-stream count (NSS) for a model, derived from its
 * catalog `streamCount` (TOTAL streams across all radios). Datasheets vary per
 * radio, so we split the total evenly across supported bands and clamp to the
 * 802.11 per-radio maximum of 4 — a defensible planning estimate that finally
 * CONSUMES streamCount (previously dead) for the capacity engine.
 */
export function perBandStreams(model: ApModel, band: Band): number {
  if (!model.bands.includes(band)) return 1;
  const perBand = Math.round(model.streamCount / Math.max(1, model.bands.length));
  return Math.max(1, Math.min(4, perBand));
}

/**
 * Straight free-space distance (ft) at which this model (on `band`) reaches `targetDbm`,
 * using the engine's log-distance path-loss constants — same model as the coverage grid.
 * Lets us compare real reach across vendors instead of assuming one AP fits all.
 */
export function estimateUsableRadiusFt(
  model: ApModel, band: Band, env: Env = 'office', targetDbm = -67,
): number {
  const radio = toDeviceRadio(model, band);
  const n = PATH_LOSS_EXP[env];
  const eirp = radio.txPowerDbm + radio.antennaGainDbi;
  // target = eirp - (REF_LOSS_1M + 10n·log10(dM))  ->  dM = 10^((eirp - refLoss - target)/(10n))
  const dM = Math.pow(10, (eirp - REF_LOSS_1M[radio.band] - targetDbm) / (10 * n));
  return dM * FT_PER_M;
}
