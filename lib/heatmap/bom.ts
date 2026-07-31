/** Bill of materials + cabling/PoE rollup from a placed design. */
import type { Device, DeviceTypeId } from './types';
import { DEVICE_REGISTRY } from './models';
import { UNIFI_APS, UNIFI_CAMERAS, UNIFI_SWITCHES, UNIFI_NVR } from './unifi';

// PoE draw estimate (W) per device type.
const POE_W: Record<DeviceTypeId, number> = {
  wifi_ap: 13, camera: 9, motion_pir_ceiling: 2, motion_pir_wall: 2, smoke_detector_spot: 1,
  heat_detector_spot: 1, access_reader: 4, paging_speaker: 12, ble_beacon: 2, iot_gateway: 8,
  smart_switch: 0, smart_plug: 0, thermostat: 2, door_lock: 4, ev_charger: 0, projector: 0, display: 0,
  electrical_outlet: 0, data_jack: 0, voice_jack: 0, combo_plate: 0, cable_term: 0,
};
// Approximate MSRP (USD) for models the catalog doesn't price directly.
const AP_PRICE: Record<string, number> = {
  'UniFi U6 Lite': 99, 'UniFi U6 LR (Long-Range)': 179, 'UniFi U6 Pro': 159, 'UniFi U6 Mesh': 179,
  'UniFi U6 In-Wall (U6-IW)': 179, 'UniFi U6 Enterprise': 279, 'UniFi U6+ (U6 Plus)': 129,
  'UniFi U7 Pro': 189, 'UniFi U7 Pro Max': 279, 'UniFi U7 Pro Wall': 199,
  'UniFi UAP-AC-Pro': 159, 'UniFi UAP-AC-Lite': 89, 'UniFi FlexHD (UAP-FlexHD)': 179,
};
const SENSOR_PRICE: Partial<Record<DeviceTypeId, number>> = {
  motion_pir_ceiling: 35, motion_pir_wall: 35, smoke_detector_spot: 45, heat_detector_spot: 45,
  access_reader: 199, paging_speaker: 65, ble_beacon: 25, iot_gateway: 99,
  smart_switch: 40, smart_plug: 25, thermostat: 130, door_lock: 180, ev_charger: 600, projector: 800, display: 500,
};

const DEFAULT_CAMERA_PRICE = 249; // fallback for catalog cameras w/o an MSRP (G4/G5 lines)
function priceFor(d: Device): number {
  const model = d.label || '';
  if (d.typeId === 'camera') {
    const cam = UNIFI_CAMERAS.find((c) => c.model === model || c.model.replace('UniFi ', '') === model);
    return cam?.priceUsd ?? DEFAULT_CAMERA_PRICE; // never $0 — cameras are the priciest category
  }
  const ap = UNIFI_APS.find((a) => a.model === model || a.model.replace('UniFi ', '') === model);
  if (d.typeId === 'wifi_ap') return AP_PRICE[ap?.model || ''] ?? 149;
  return SENSOR_PRICE[d.typeId] ?? 0;
}

export interface BomRow { item: string; typeId: DeviceTypeId | 'infra'; qty: number; unit: number; ext: number }
export interface BomResult {
  rows: BomRow[]; deviceTotal: number; poeWatts: number; cat6Runs: number;
  recSwitch: { model: string; poeBudgetW: number; priceUsd?: number } | null;
  recNvr: { model: string; priceUsd: number } | null;
  total: number;
  // Labor-loaded TURNKEY install price — the number a GC actually bids. No competitor (Ekahau/
  // Hamina/iBwave/UniFi/NetSpot) emits an installed dollar figure; this is our moat.
  laborHours: number; laborCost: number; overhead: number; profit: number; turnkey: number;
}

/** Install labor + markup inputs (tenant/project-tunable; sensible industry defaults). */
export interface TurnkeyOpts { crewRateUsd?: number; laborPerDropHr?: number; overheadPct?: number; profitPct?: number; }
// Rough install labor-hours per device type (blended-crew industry defaults; string-keyed so any
// device id is safe — unknown types fall back to DEFAULT_INSTALL_HR).
const INSTALL_HOURS: Record<string, number> = {
  wifi_ap: 1.5, camera: 2.0, door_lock: 3.5, access_reader: 3.0, pir: 0.75, pir_sensor: 0.75,
  smoke: 1.0, smoke_detector: 1.0, iot_gateway: 1.5, data_jack: 0.5, voice_jack: 0.5,
  combo_plate: 0.75, electrical_outlet: 0.5, cable_term: 1.0,
};
const DEFAULT_INSTALL_HR = 1.0;

export function computeBom(devices: Device[], opts: TurnkeyOpts = {}): BomResult {
  const groups = new Map<string, BomRow>();
  let poe = 0;
  for (const d of devices) {
    const def = DEVICE_REGISTRY[d.typeId];
    const model = d.label && d.label !== def.short ? d.label : def.label;
    const key = d.typeId + '|' + model;
    const unit = priceFor(d);
    const g = groups.get(key) || { item: model, typeId: d.typeId, qty: 0, unit, ext: 0 };
    g.qty++; g.ext = g.qty * g.unit; groups.set(key, g);
    poe += POE_W[d.typeId] || 0;
  }
  const rows = [...groups.values()].sort((a, b) => b.ext - a.ext);
  const cat6 = devices.filter((d) => (POE_W[d.typeId] || 0) > 0).length; // one home-run per PoE device

  // recommend switch(es): PoE budget sized to ≤70% utilization
  const needBudget = poe / 0.7;
  const cams = devices.filter((d) => d.typeId === 'camera').length;
  const poeSw = UNIFI_SWITCHES.filter((s) => s.poeBudgetW > 0).sort((a, b) => a.poeBudgetW - b.poeBudgetW);
  const recSwitch = poeSw.find((s) => s.poeBudgetW >= needBudget) || poeSw[poeSw.length - 1] || null;
  const recNvr = cams > 0 ? { model: UNIFI_NVR[0].model, priceUsd: UNIFI_NVR[0].priceUsd } : null;

  const infra: BomRow[] = [];
  if (recSwitch) {
    const swCount = Math.max(1, Math.ceil(needBudget / recSwitch.poeBudgetW));
    infra.push({ item: `${recSwitch.model} (PoE switch)`, typeId: 'infra', qty: swCount, unit: recSwitch.priceUsd ?? 0, ext: swCount * (recSwitch.priceUsd ?? 0) });
  }
  if (recNvr) infra.push({ item: `${recNvr.model} (recorder)`, typeId: 'infra', qty: 1, unit: recNvr.priceUsd, ext: recNvr.priceUsd });
  if (cat6) infra.push({ item: 'Cat6 STP home-run (per device)', typeId: 'infra', qty: cat6, unit: 0, ext: 0 });

  const allRows = [...rows, ...infra];
  const deviceTotal = rows.reduce((s, r) => s + r.ext, 0);
  const total = allRows.reduce((s, r) => s + r.ext, 0);
  // ── labor-loaded TURNKEY install price (hardware + install labor + overhead + profit) ──
  const crewRate = opts.crewRateUsd ?? 85;      // $/hr blended install crew
  const perDrop = opts.laborPerDropHr ?? 0.75;  // hours to pull + terminate one cable drop
  const overheadPct = opts.overheadPct ?? 0.10;
  const profitPct = opts.profitPct ?? 0.15;
  let installHours = 0;
  for (const d of devices) installHours += INSTALL_HOURS[d.typeId] ?? DEFAULT_INSTALL_HR;
  const laborHours = Math.round((installHours + cat6 * perDrop) * 10) / 10;
  const laborCost = Math.round(laborHours * crewRate);
  const base = total + laborCost;               // hardware (incl. switch/NVR) + install labor
  const overhead = Math.round(base * overheadPct);
  const profit = Math.round((base + overhead) * profitPct);
  const turnkey = base + overhead + profit;
  return { rows: allRows, deviceTotal, poeWatts: poe, cat6Runs: cat6, recSwitch: recSwitch ? { model: recSwitch.model, poeBudgetW: recSwitch.poeBudgetW, priceUsd: recSwitch.priceUsd } : null, recNvr, total, laborHours, laborCost, overhead, profit, turnkey };
}
