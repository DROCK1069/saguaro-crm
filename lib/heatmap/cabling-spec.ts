/**
 * Low-voltage cable-recommendation engine.
 * Given a placed device + the run conditions (indoor/outdoor, distance, EMI, plenum),
 * recommends the DATA cable, any POWER/composite cable, the termination method, and a
 * plain-English WHY a GC understands. Grounded in TIA-568 / NEC 725/760/800 practice.
 *
 * Deterministic, DOM-free — usable in web, iOS, and the bid-jacket estimator.
 */
import type { Device, DeviceTypeId, HeatmapProject } from './types';
import type { Pt } from './geometry';
import { dist } from './geometry';

export type CableId =
  | 'cat6' | 'cat6a' | 'cat6a_futp' | 'cat8'
  | 'om4_fiber' | 'os2_fiber' | 'osp_cat6a'
  | 'ac_composite' | 'power_18_2' | 'osdp_22_shielded' | 'speaker_16_2' | 'fplr_fire';

export interface CableSpec {
  id: CableId;
  name: string;
  category: 'data' | 'power' | 'fiber' | 'composite' | 'fire';
  /** default jacket rating when installed indoors */
  rating: string;
  useFor: string;
  why: string;
  /** rough material cost per foot (USD) for budgeting */
  costPerFt: number;
}

export const CABLE_CATALOG: Record<CableId, CableSpec> = {
  cat6: { id: 'cat6', name: 'Cat6 U/UTP', category: 'data', rating: 'CMR (riser) / CMP where in plenum', costPerFt: 0.35,
    useFor: '1 Gbps drops on short runs with low PoE draw (phones, basic sensors, smart switches, thermostats)',
    why: '250 MHz, 1 Gbps to the full 100 m — but 10GBASE-T only reaches ~37-55 m, so it is a budget 1G choice only; never promise 10G on it.' },
  cat6a: { id: 'cat6a', name: 'Cat6A U/UTP', category: 'data', rating: 'CMR (riser) / CMP above HVAC ceilings', costPerFt: 0.55,
    useFor: 'Default new commercial data drop; required for high-PoE devices (Wi-Fi 6/7 APs, IR/PTZ cameras, access hubs, displays)',
    why: '23 AWG, 500 MHz, reliable 10GBASE-T to the full 100 m plus lower loop resistance = less heat and voltage drop under 802.3bt PoE. A 15-20 yr future-proof baseline.' },
  cat6a_futp: { id: 'cat6a_futp', name: 'Cat6A F/UTP (shielded)', category: 'data', rating: 'CMR / CMP', costPerFt: 0.80,
    useFor: 'High-PoE devices in dense bundles/conduit, or runs near VFDs, motors, elevators, welders, or parallel power feeders',
    why: 'Foil rejects alien crosstalk + EMI and adds a heat path that keeps the bundle cooler under Type 3/4 PoE. Needs shielded jacks/panels bonded to a TIA-607 ground or it acts as an antenna.' },
  cat8: { id: 'cat8', name: 'Cat8 S/FTP', category: 'data', rating: 'CMR / CMP', costPerFt: 1.60,
    useFor: 'Short backbone / equipment-room switch-to-switch links at 25/40G under 30 m',
    why: '2000 MHz, 25/40GBASE-T but capped at 30 m over a 2-connector channel — valid only for short high-rate backbone; beyond 30 m use fiber. Always shielded + bonded.' },
  om4_fiber: { id: 'om4_fiber', name: 'OM4 Multimode Fiber (LC)', category: 'fiber', rating: 'OFNR (riser) / OFNP (plenum)', costPerFt: 0.90,
    useFor: 'In-building backbone risers + equipment-room links at 10-100G under a few hundred meters',
    why: "Cheap 850 nm optics at short reach; 10G to ~400 m. Use where copper's 100 m channel limit is exceeded inside a building." },
  os2_fiber: { id: 'os2_fiber', name: 'OS2 Singlemode Fiber (LC)', category: 'fiber', rating: 'OFNR / OFNP indoor; OSP wet/UV outdoors', costPerFt: 0.75,
    useFor: 'Campus / inter-building backbone, outside-plant runs, and anything you may push past 100G',
    why: '9/125 SM reaches km-scale (10G to ~10 km); also breaks copper ground loops and the lightning path between buildings.' },
  osp_cat6a: { id: 'osp_cat6a', name: 'Outdoor/OSP Cat6A (UV, direct-burial)', category: 'data', rating: 'OSP — transition to CMR/CMP within 50 ft of entry', costPerFt: 0.95,
    useFor: 'Exterior device drops (gate cameras, parking APs, dock readers) under 100 m where fiber is overkill',
    why: 'UV-resistant, water-blocked jacket survives sun + ground-water that destroy indoor PVC. Per NEC 800.113 must transition to a listed indoor rating within 50 ft of entry.' },
  ac_composite: { id: 'ac_composite', name: 'Access-control composite (18/4 + 22/4 + 22/2 + 22/3-shield)', category: 'composite', rating: 'CMR / CMP', costPerFt: 0.85,
    useFor: 'A full electrified door: lock power + REX + door contact + reader data in one jacket',
    why: 'One pull instead of four (~4:1 fewer pulls per door) while keeping 18 AWG lock power physically separated from the shielded reader pair.' },
  power_18_2: { id: 'power_18_2', name: '18 AWG 2-conductor power (18/2)', category: 'power', rating: 'CMR / CMP', costPerFt: 0.28,
    useFor: 'Low-voltage DC power to an electrified lock, strike, maglock, or 12/24V device',
    why: '18 AWG gives DC voltage-drop headroom to ~100 ft; sized for current, not signal, and kept away from data pairs. Beyond ~100 ft upsize to 16 AWG or add a local PSU.' },
  osdp_22_shielded: { id: 'osdp_22_shielded', name: 'OSDP/RS-485 reader cable (22 AWG shielded TP)', category: 'data', rating: 'CMR / CMP', costPerFt: 0.30,
    useFor: 'Modern reader data run (OSDP) when not bundled in the access composite',
    why: 'Differential RS-485 over shielded twisted-pair rejects EMI and reaches ~4,000 ft. Shield/drain lands at the controller end ONLY to avoid a ground loop.' },
  speaker_16_2: { id: 'speaker_16_2', name: '16 AWG 2-conductor speaker (16/2)', category: 'power', rating: 'CMR / CMP', costPerFt: 0.32,
    useFor: '70V/100V constant-voltage paging/speaker runs to analog horn/ceiling speakers',
    why: 'Constant-voltage audio needs a dedicated pair sized for power + run length; 16 AWG covers typical branch runs. (PoE/IP speakers use Cat6A instead.)' },
  fplr_fire: { id: 'fplr_fire', name: 'FPLR fire-alarm cable (NEC 760)', category: 'fire', rating: 'FPLR (riser) / FPLP (plenum)', costPerFt: 0.40,
    useFor: 'Smoke/heat detectors + other life-safety devices back to the fire-alarm control panel (FACP)',
    why: 'Life-safety is an NEC Article 760 fire-alarm circuit on FPLR/FPLP cable, wired by the fire-alarm contractor to the AHJ — kept separate from the NEC 725 data/access network.' },
};

export interface DeviceCabling {
  dataCable: CableId | null;
  powerCable: CableId | null;
  termination: string;
  poeW: number;
  why: string;
}

/** Per-device baseline cabling (indoor, normal EMI). recommendCabling() applies run overrides. */
export const DEVICE_CABLING: Partial<Record<DeviceTypeId, DeviceCabling>> = {
  wifi_ap: { dataCable: 'cat6a', powerCable: null, poeW: 30, termination: 'RJ45 keystone (T568B) → single 4-pair home-run to a PoE+/PoE++ switch port',
    why: 'Wi-Fi 6/6E/7 APs pull 25-51 W and want 10G-capable uplink headroom; Cat6A runs cooler and holds insertion loss over the full 100 m.' },
  camera: { dataCable: 'cat6a', powerCable: null, poeW: 30, termination: 'RJ45 field plug/keystone at the camera → home-run to a PoE++ switch or midspan',
    why: 'PTZ/IR/heated cameras are Type 3/4 PDs (up to ~60-90 W); Cat6A cuts I2R heat + voltage drop. Dense bundles → F/UTP; exterior → OSP jacket.' },
  access_reader: { dataCable: 'osdp_22_shielded', powerCable: null, poeW: 0, termination: '22 AWG shielded TP to the controller/UA-Hub reader input; shield landed at the panel end ONLY',
    why: 'OSDP/RS-485 needs the twist + shield for EMI immunity (~4,000 ft); single-point panel-end shield grounding prevents a ground loop. In a full door, carry as the reader element of the access composite.' },
  door_lock: { dataCable: null, powerCable: 'power_18_2', poeW: 0, termination: '18 AWG lock pair → PSU relay (or hub lock relay), ferruled; maglocks/fail-safe on the fire-alarm-released output',
    why: '18 AWG carries the lock current with voltage-drop headroom to ~100 ft. Maglocks + fail-safe strikes must drop on fire/power loss for egress. Never use Cat5e/6 for lock current.' },
  paging_speaker: { dataCable: null, powerCable: 'speaker_16_2', poeW: 0, termination: '16 AWG pair to the 70V/100V amplifier tap (or Cat6A + RJ45 if it is a PoE/IP speaker)',
    why: 'Constant-voltage (70V/100V) audio needs a dedicated power-sized pair per branch; 16 AWG keeps line loss low. Switch to Cat6A + PoE only for IP endpoints.' },
  motion_pir_ceiling: { dataCable: null, powerCable: 'power_18_2', poeW: 0, termination: '22 AWG dry-contact/power run to the panel or REX input (or the REX element of the access composite)',
    why: 'A ceiling PIR is a low-power dry-contact device; it rides low-voltage power/contact conductors back to the controller, not a data cable.' },
  motion_pir_wall: { dataCable: null, powerCable: 'power_18_2', poeW: 0, termination: '22 AWG dry-contact/power run to the alarm/access panel',
    why: 'Wall PIR is a dry-contact intrusion device on low-voltage conductors to the panel.' },
  smoke_detector_spot: { dataCable: null, powerCable: 'fplr_fire', poeW: 0, termination: 'FPLR/FPLP fire-alarm cable back to the FACP — wired by the fire-alarm contractor to the AHJ',
    why: 'Life-safety is an NEC Article 760 circuit on fire-rated cable, kept separate from the data/access network. This drop belongs to the fire-alarm scope.' },
  heat_detector_spot: { dataCable: null, powerCable: 'fplr_fire', poeW: 0, termination: 'FPLR/FPLP fire-alarm cable back to the FACP (fire-alarm contractor scope)',
    why: 'Heat detection is an NEC 760 life-safety circuit on fire-rated cable to the FACP, separate from the low-voltage data network.' },
  iot_gateway: { dataCable: 'cat6a', powerCable: null, poeW: 15, termination: 'RJ45 keystone → home-run to a PoE switch port',
    why: 'A gateway/controller is a PoE network endpoint; Cat6A gives uplink + PoE headroom for future devices behind it.' },
  smart_switch: { dataCable: 'cat6', powerCable: null, poeW: 15, termination: 'RJ45 keystone → home-run to a PoE switch port',
    why: 'A low-draw 1 Gbps endpoint — Cat6 is sufficient and cost-effective; no 10G/high-PoE requirement.' },
  smart_plug: { dataCable: 'cat6', powerCable: null, poeW: 0, termination: 'Usually wireless; if wired, RJ45 keystone → 1G switch port',
    why: 'A low-bandwidth endpoint — Cat6 covers it when a wired drop is used.' },
  thermostat: { dataCable: 'cat6', powerCable: null, poeW: 15, termination: 'RJ45 keystone → PoE switch port (or 18/2 to the HVAC controller if analog)',
    why: 'IP/PoE thermostats are low-draw 1G endpoints — Cat6 is appropriate.' },
  ev_charger: { dataCable: 'cat6a', powerCable: null, poeW: 0, termination: 'Cat6A data to the charger network port (line power is a separate NEC 625 electrical circuit by the EC)',
    why: 'The data/OCPP link uses Cat6A (often outdoor OSP + shielded near the feeder); the 240V charging circuit is the electrician’s scope, not low-voltage.' },
  display: { dataCable: 'cat6a', powerCable: null, poeW: 51, termination: 'RJ45 keystone → PoE++ switch port (or HDBaseT/Cat6A to the AV matrix)',
    why: 'A PoE display/signage panel can pull Type 4 (up to ~71 W); Cat6A handles the power + the video bandwidth over HDBaseT.' },
  projector: { dataCable: 'cat6a', powerCable: null, poeW: 0, termination: 'Cat6A/HDBaseT to the AV matrix or control network',
    why: 'AV extension (HDBaseT) rides Cat6A for the bandwidth + reach; keep it off shared PoE switches if it carries power.' },
  ble_beacon: { dataCable: 'cat6', powerCable: null, poeW: 5, termination: 'RJ45 keystone → PoE switch port (many are battery/USB and need no drop)',
    why: 'A very low-draw endpoint; Cat6 is plenty when a wired/PoE drop is used at all.' },
};

const FALLBACK: DeviceCabling = { dataCable: 'cat6a', powerCable: null, poeW: 15, termination: 'RJ45 keystone → home-run to a PoE switch port', why: 'Default new commercial data drop.' };

export interface RunContext {
  /** run distance in feet (device → rack), already including slack if desired */
  distanceFt?: number;
  outdoor?: boolean;
  /** near VFDs/motors/elevators/parallel power → shielded */
  emi?: boolean;
  /** run passes through an HVAC air-handling plenum */
  plenum?: boolean;
}

export interface CableRecommendation {
  dataCable: CableSpec | null;
  powerCable: CableSpec | null;
  termination: string;
  poeW: number;
  jacket: string;
  why: string;
  /** extra notes from the run conditions (outdoor transition, distance→fiber, EMI→shielded) */
  notes: string[];
}

const COPPER: CableId[] = ['cat6', 'cat6a', 'cat6a_futp', 'osp_cat6a'];

/** Recommend cabling for one device given the run conditions (applies the TIA/NEC selection rules). */
export function recommendCabling(typeId: DeviceTypeId, ctx: RunContext = {}): CableRecommendation {
  const base = DEVICE_CABLING[typeId] || FALLBACK;
  const notes: string[] = [];
  let dataId = base.dataCable;

  if (dataId && COPPER.includes(dataId)) {
    // distance beyond the 100 m / 328 ft copper channel → fiber
    if ((ctx.distanceFt ?? 0) > 328) {
      dataId = 'om4_fiber';
      notes.push(`Run exceeds the 328 ft (100 m) copper limit → OM4 fiber. Balanced copper is not rated past a 90 m link + 10 m of patch cords.`);
    } else if (ctx.outdoor) {
      dataId = 'osp_cat6a';
      notes.push('Exterior run → UV/wet outdoor-rated (OSP) jacket, transitioning to a listed indoor rating within 50 ft of entry (NEC 800.113).');
    } else if (ctx.emi) {
      dataId = 'cat6a_futp';
      notes.push('Route passes near EMI (VFDs, motors, elevators, parallel feeders) → shielded F/UTP; bond the shield to a TIA-607 ground end-to-end.');
    }
  }
  if (ctx.plenum) notes.push('Run is in an HVAC air-handling plenum → plenum (CMP/OFNP/FPLP) jacket is required by NEC 800.');

  const data = dataId ? CABLE_CATALOG[dataId] : null;
  const jacket = ctx.plenum ? 'CMP / plenum-rated (required in air-handling spaces)' : (data?.rating || '—');
  return {
    dataCable: data,
    powerCable: base.powerCable ? CABLE_CATALOG[base.powerCable] : null,
    termination: base.termination,
    poeW: base.poeW,
    jacket,
    why: base.why,
    notes,
  };
}

export interface CableRun {
  device: Device;
  label: string;
  lengthFt: number;
  rec: CableRecommendation;
}

export interface CableSummary {
  runs: CableRun[];
  /** total feet + material cost per cable id used */
  byCable: { cable: CableSpec; feet: number; cost: number }[];
  totalFeet: number;
  totalCost: number;
  poeWatts: number;
}

/** slack + ceiling-drop allowance applied to a straight device→rack distance */
export function runLengthFt(devicePos: Pt, rackPos: Pt, pxPerFt: number, slack = 1.35, dropFt = 18): number {
  const straightFt = dist(devicePos, rackPos) / pxPerFt;
  return Math.ceil((straightFt * slack + dropFt) / 5) * 5;
}

/** Build a full cable schedule for a project: one run per device back to the rack, cable by type, footage + cost. */
export function summarizeCables(p: HeatmapProject, rackPos: Pt, ctx: Omit<RunContext, 'distanceFt'> = {}): CableSummary {
  const pxPerFt = p.scale?.pxPerFt || 10;
  const runs: CableRun[] = p.devices.map((d, i) => {
    const lengthFt = runLengthFt(d.pos, rackPos, pxPerFt);
    const rec = recommendCabling(d.typeId, { ...ctx, distanceFt: lengthFt });
    return { device: d, label: d.label || d.typeId, lengthFt, rec };
  });
  const tally = new Map<CableId, number>();
  let poeWatts = 0;
  for (const r of runs) {
    poeWatts += r.rec.poeW;
    for (const c of [r.rec.dataCable, r.rec.powerCable]) if (c) tally.set(c.id, (tally.get(c.id) || 0) + r.lengthFt);
  }
  const byCable = [...tally.entries()].map(([id, feet]) => ({ cable: CABLE_CATALOG[id], feet, cost: Math.round(feet * CABLE_CATALOG[id].costPerFt) }))
    .sort((a, b) => b.feet - a.feet);
  return { runs, byCable, totalFeet: byCable.reduce((s, c) => s + c.feet, 0), totalCost: byCable.reduce((s, c) => s + c.cost, 0), poeWatts };
}

/** Job-level selection rules + termination notes, for the report's guidance section. */
export const SELECTION_RULES: string[] = [
  'Default new commercial data drop = Cat6A (CMR): future-proof 10GBASE-T to 100 m with the best PoE thermal headroom.',
  'Budget 1G drop, no high PoE (phones, sensors, thermostats) = Cat6 is fine — but never promise 10G on it.',
  'Any PoE camera / AP / display drawing 802.3bt Type 3-4 (60-90 W) = Cat6A: less I2R heat + voltage drop.',
  'Run over 328 ft (100 m) = fiber (OM4 in-building, OS2 campus); copper is not rated past that channel limit.',
  '25-40G backbone under 30 m = Cat8 (shielded); beyond 30 m use fiber.',
  'Plenum (HVAC return air) = CMP required; riser (floor-to-floor) = CMR; outdoor/buried = UV/wet OSP, transitioning indoors within 50 ft.',
  'Near VFDs / motors / elevators = shielded F/UTP Cat6A, bonded to a TIA-607 ground end-to-end.',
  'Electrified door = one access composite (18/4 lock + 22/4 REX + 22/2 contact + 22/3-shield reader) instead of four home-runs.',
  'Lock power = 18 AWG to ~100 ft; prefer 24VDC over 12VDC on long runs to halve voltage drop. Maglocks/fail-safe on the fire-released PSU output.',
  'Smoke/heat detectors = NEC 760 fire-alarm cable (FPLR/FPLP) to the FACP — fire-alarm contractor scope, separate from the data network.',
];
