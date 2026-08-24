/** Bill of materials + cabling/PoE rollup from a placed design. */
import type { Device, DeviceTypeId } from './types';
import { DEVICE_REGISTRY } from './models';
import { UNIFI_APS, UNIFI_CAMERAS, UNIFI_SWITCHES, UNIFI_NVR } from './unifi';

// PoE draw estimate (W) per device type.
const POE_W: Record<DeviceTypeId, number> = {
  wifi_ap: 13, camera: 9, motion_pir_ceiling: 2, motion_pir_wall: 2, smoke_detector_spot: 1,
  heat_detector_spot: 1, access_reader: 4, paging_speaker: 12, ble_beacon: 2, iot_gateway: 8,
  smart_switch: 0, smart_plug: 0, thermostat: 2, door_lock: 4, ev_charger: 0, projector: 0, display: 0,
  electrical_outlet: 0, data_jack: 0, voice_jack: 0, combo_plate: 0, cable_term: 0, idf: 0,
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

/* ── Copper rough-in assemblies (data / voice / combo / receptacle / field termination).
   These are PLACED DEVICES and every one of them already draws install labor from
   INSTALL_HOURS below. Pricing them at $0 charged the crew hour but never landed the
   material, so every termination on a low-voltage bid came out under-priced. Real
   per-device assembly cost: faceplate + mud ring or device box + the keystones /
   receptacles actually specified on that device. `idf` is deliberately absent — the
   rack, PDU and cable management are priced once by the head-end infra line below. ── */
type CopperSpec = { base: number; per: number; countOf: 'ports' | 'gang' | null; defaultCount: number };
const COPPER_PRICE: Partial<Record<DeviceTypeId, CopperSpec>> = {
  data_jack:         { base: 8,  per: 6,   countOf: 'ports', defaultCount: 1 }, // plate + ring, Cat6 keystone per port
  voice_jack:        { base: 8,  per: 4,   countOf: 'ports', defaultCount: 1 }, // plate + ring, RJ11 keystone per port
  combo_plate:       { base: 16, per: 6,   countOf: 'ports', defaultCount: 1 }, // 2-gang combo plate + box + divider + receptacle, keystone per port
  electrical_outlet: { base: 5,  per: 2.5, countOf: 'gang',  defaultCount: 2 }, // device box + plate + receptacle(s)
  cable_term:        { base: 7,  per: 0,   countOf: null,    defaultCount: 0 }, // field-term connector (jack or plug)
};
/** Copper outlets that are a STATION CABLE home-run back to the rack — one run per port. */
const COPPER_RUN_TYPES = new Set<DeviceTypeId>(['data_jack', 'voice_jack', 'combo_plate']);
/** How many keystones / receptacles this device actually carries (never < 1 when it counts). */
function copperCount(d: Device, spec: CopperSpec): number {
  if (!spec.countOf) return 0;
  const raw = spec.countOf === 'ports' ? d.ports : d.gang;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : spec.defaultCount;
}
/** Port/gang count for a copper outlet — used for its station-cable home-runs. */
function copperPorts(d: Device): number {
  const spec = COPPER_PRICE[d.typeId];
  return spec ? Math.max(1, copperCount(d, spec)) : 1;
}
/** Variant suffix so a 1-port jack never groups (and prices) as a 4-port jack. */
function copperVariant(d: Device): string {
  const spec = COPPER_PRICE[d.typeId];
  if (!spec) return '';
  if (!spec.countOf) return d.typeId === 'cable_term' ? (d.gender === 'M' ? ' — plug (M)' : ' — jack (F)') : '';
  const n = copperCount(d, spec);
  return spec.countOf === 'ports' ? ` — ${n}-port` : ` — ${n}-receptacle`;
}

const DEFAULT_CAMERA_PRICE = 249; // fallback for catalog cameras w/o an MSRP (G4/G5 lines)
function priceFor(d: Device): number {
  const model = d.label || '';
  if (d.typeId === 'camera') {
    const cam = UNIFI_CAMERAS.find((c) => c.model === model || c.model.replace('UniFi ', '') === model);
    return cam?.priceUsd ?? DEFAULT_CAMERA_PRICE; // never $0 — cameras are the priciest category
  }
  const ap = UNIFI_APS.find((a) => a.model === model || a.model.replace('UniFi ', '') === model);
  if (d.typeId === 'wifi_ap') return AP_PRICE[ap?.model || ''] ?? 149;
  const copper = COPPER_PRICE[d.typeId];
  if (copper) return Math.round((copper.base + copper.per * copperCount(d, copper)) * 100) / 100;
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
  combo_plate: 0.75, electrical_outlet: 0.5, cable_term: 1.0, idf: 0,
};
const DEFAULT_INSTALL_HR = 1.0;
/** Material cost of one home-run of shielded Cat6: 150 ft avg × ~$0.30/ft, rounded. */
const CAT6_RUN_USD = 45;
/* Approximate MSRP (USD) for the PoE switches the catalog does not price. Only one entry in
   UNIFI_SWITCHES carries priceUsd, so the head-end switch — the single most expensive line in a
   low-voltage bid after the cameras — was landing at $0 on nearly every design while its labor
   was still charged. Unpriced models fall back to a budget-scaled figure, never $0. */
const SWITCH_PRICE: Record<string, number> = {
  'UniFi Pro Max 16 PoE': 399, 'USW-Lite-8-PoE': 109, 'USW-Lite-16-PoE': 199,
  'USW-Pro-24-PoE': 699, 'USW-Pro-48-PoE': 1099, 'USW-Enterprise-24-PoE': 1099,
  'USW-Enterprise-48-PoE': 1799, 'USW-Flex': 99, 'USW-Flex-Mini': 29,
  'USW-Aggregation': 279, 'USW-Pro-Aggregation': 999, 'USW-Industrial': 899,
};
/** Never $0: catalog MSRP → our table → ~$2/W of PoE budget (floor $149) for anything unlisted. */
function switchPrice(sw: { model: string; poeBudgetW: number; priceUsd?: number }): number {
  return sw.priceUsd ?? SWITCH_PRICE[sw.model] ?? Math.max(149, Math.round(sw.poeBudgetW * 2));
}

export function computeBom(devices: Device[], opts: TurnkeyOpts = {}): BomResult {
  const groups = new Map<string, BomRow>();
  let poe = 0;
  for (const d of devices) {
    const def = DEVICE_REGISTRY[d.typeId];
    const model = (d.label && d.label !== def.short ? d.label : def.label) + copperVariant(d);
    const key = d.typeId + '|' + model;
    const unit = priceFor(d);
    const g = groups.get(key) || { item: model, typeId: d.typeId, qty: 0, unit, ext: 0 };
    g.qty++; g.ext = g.qty * g.unit; groups.set(key, g);
    poe += POE_W[d.typeId] || 0;
  }
  const rows = [...groups.values()].sort((a, b) => b.ext - a.ext);
  // Cable runs: one home-run per PoE device, PLUS one station cable per copper outlet PORT.
  // Counting only PoE devices left every data/voice/combo drop out of the cable, termination,
  // patch-panel and patch-cord lines below — the silent under-price on any low-voltage bid.
  const poeRuns = devices.filter((d) => (POE_W[d.typeId] || 0) > 0).length;
  const copperRuns = devices.reduce((n, d) => n + (COPPER_RUN_TYPES.has(d.typeId) ? copperPorts(d) : 0), 0);
  const cat6 = poeRuns + copperRuns;

  // recommend switch(es): PoE budget sized to ≤70% utilization
  const needBudget = poe / 0.7;
  const cams = devices.filter((d) => d.typeId === 'camera').length;
  const poeSw = UNIFI_SWITCHES.filter((s) => s.poeBudgetW > 0).sort((a, b) => a.poeBudgetW - b.poeBudgetW);
  const recSwitch = poeSw.find((s) => s.poeBudgetW >= needBudget) || poeSw[poeSw.length - 1] || null;
  const recNvr = cams > 0 ? { model: UNIFI_NVR[0].model, priceUsd: UNIFI_NVR[0].priceUsd } : null;

  const infra: BomRow[] = [];
  if (recSwitch) {
    const swCount = Math.max(1, Math.ceil(needBudget / recSwitch.poeBudgetW));
    const swUnit = switchPrice(recSwitch); // never $0 — see SWITCH_PRICE
    infra.push({ item: `${recSwitch.model} (PoE switch)`, typeId: 'infra', qty: swCount, unit: swUnit, ext: swCount * swUnit });
  }
  if (recNvr) infra.push({ item: `${recNvr.model} (recorder)`, typeId: 'infra', qty: 1, unit: recNvr.priceUsd, ext: recNvr.priceUsd });
  // The cable itself. This line used to carry unit $0 — a real quantity with a fake price,
  // which is worse than omitting it. Priced off a documented assumption a GC can audit and
  // override: 150 ft average run × ~$0.30/ft shielded Cat6 (1,000 ft box), rounded to $45.
  if (cat6) infra.push({ item: 'Cat6 STP cable — home-run per drop (150 ft avg @ ~$0.30/ft)', typeId: 'infra', qty: cat6, unit: CAT6_RUN_USD, ext: cat6 * CAT6_RUN_USD });
  /* ── The REST of a real low-volt schedule (field truth, 20 Aug 2026: a bid
     package without terminations, pulls, head-end, or door hardware is not
     biddable — "it needs cat cable, ends, pulls, modem, fiber, router, switches,
     controller, access control, mag locks, push-button entry"). ── */
  if (cat6) {
    infra.push({ item: 'RJ45 terminations — keystone at device + panel punch-down (both ends, tested)', typeId: 'infra', qty: cat6 * 2, unit: 6, ext: cat6 * 2 * 6 });
    const panels = Math.ceil(cat6 / 24);
    infra.push({ item: '24-port Cat6 patch panel', typeId: 'infra', qty: panels, unit: 59, ext: panels * 59 });
    infra.push({ item: 'Patch cords, faceplates & surface boxes', typeId: 'infra', qty: cat6, unit: 9, ext: cat6 * 9 });
  }
  if (poe > 0 || cat6 > 0) {
    const gw = devices.length > 15
      ? { model: 'UniFi Dream Machine Pro (UDM-Pro)', price: 379 }
      : { model: 'UniFi Dream Router 7 (UDR7)', price: 279 };
    infra.push({ item: `${gw.model} — router + UniFi Network controller`, typeId: 'infra', qty: 1, unit: gw.price, ext: gw.price });
    infra.push({ item: 'Wall-mount rack, PDU & cable management', typeId: 'infra', qty: 1, unit: 249, ext: 249 });
    infra.push({ item: 'ISP handoff — modem/ONT + fiber uplink allowance', typeId: 'infra', qty: 1, unit: 350, ext: 350 });
  }
  const doorsReaders = devices.filter((d) => d.typeId === 'access_reader').length;
  const doorsLocks = devices.filter((d) => d.typeId === 'door_lock').length;
  const doors = Math.max(doorsReaders, doorsLocks);
  if (doors > 0) {
    const magsNeeded = Math.max(0, doors - doorsLocks);
    if (magsNeeded) infra.push({ item: 'Mag lock 1,200 lb w/ mounting hardware', typeId: 'infra', qty: magsNeeded, unit: 189, ext: magsNeeded * 189 });
    infra.push({ item: 'Request-to-exit push button', typeId: 'infra', qty: doors, unit: 45, ext: doors * 45 });
    infra.push({ item: 'Door position switch', typeId: 'infra', qty: doors, unit: 15, ext: doors * 15 });
    const hubs = Math.ceil(doors / 4);
    infra.push({ item: 'Access hub / door controller (4-door)', typeId: 'infra', qty: hubs, unit: 199, ext: hubs * 199 });
    infra.push({ item: 'Access power supply w/ battery backup', typeId: 'infra', qty: hubs, unit: 159, ext: hubs * 159 });
  }

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
  return { rows: allRows, deviceTotal, poeWatts: poe, cat6Runs: cat6, recSwitch: recSwitch ? { model: recSwitch.model, poeBudgetW: recSwitch.poeBudgetW, priceUsd: switchPrice(recSwitch) } : null, recNvr, total, laborHours, laborCost, overhead, profit, turnkey };
}
