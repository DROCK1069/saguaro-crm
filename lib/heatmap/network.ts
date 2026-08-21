/** IP / VLAN / switch-port schedule generated from the placed devices. */
import type { Device, DeviceTypeId, Ssid } from './types';
import { DEVICE_REGISTRY } from './models';

export interface Vlan { id: number; name: string; subnet: string }
export const VLANS = {
  mgmt: { id: 10, name: 'Management', subnet: '10.0.10' },
  wifi: { id: 20, name: 'Wireless', subnet: '10.0.20' },
  guest: { id: 25, name: 'Guest', subnet: '10.0.25' },
  camera: { id: 30, name: 'Cameras', subnet: '10.0.30' },
  security: { id: 40, name: 'Security / Life-Safety', subnet: '10.0.40' },
  iot: { id: 50, name: 'IoT / BAS', subnet: '10.0.50' },
  av: { id: 60, name: 'AV', subnet: '10.0.60' },
} as const;
export type VlanKey = keyof typeof VLANS;

/** Resolve a VLAN by its map key (SSIDs store a key, not the object). */
export function vlanForKey(key: string): Vlan | null {
  return (VLANS as Record<string, Vlan>)[key] || null;
}
/** Same lookup under the web app's historical name — one engine, both callers. */
export const vlanFor = vlanForKey;

/** Sensible default Wi-Fi networks for a new design (real, editable config). */
export const DEFAULT_SSIDS: Ssid[] = [
  { name: 'Corp',  vlanKey: 'wifi',  band: 'all', security: 'wpa3' },
  { name: 'Guest', vlanKey: 'guest', band: '5',   security: 'wpa2' },
  { name: 'IoT',   vlanKey: 'iot',   band: '2.4', security: 'wpa2' },
];

const VLAN_FOR: Record<DeviceTypeId, VlanKey> = {
  wifi_ap: 'mgmt', iot_gateway: 'iot', ble_beacon: 'iot',
  camera: 'camera',
  access_reader: 'security', door_lock: 'security', motion_pir_ceiling: 'security',
  motion_pir_wall: 'security', smoke_detector_spot: 'security', heat_detector_spot: 'security',
  paging_speaker: 'av', projector: 'av', display: 'av',
  smart_switch: 'iot', smart_plug: 'iot', thermostat: 'iot', ev_charger: 'iot',
  // rough-in markers — data/voice ride the data VLAN; power/termination are not network endpoints
  data_jack: 'wifi', voice_jack: 'av', combo_plate: 'wifi', electrical_outlet: 'mgmt', cable_term: 'mgmt',
};

const POE_W: Record<DeviceTypeId, number> = {
  wifi_ap: 13, camera: 9, motion_pir_ceiling: 2, motion_pir_wall: 2, smoke_detector_spot: 1,
  heat_detector_spot: 1, access_reader: 4, paging_speaker: 12, ble_beacon: 2, iot_gateway: 8,
  smart_switch: 0, smart_plug: 0, thermostat: 2, door_lock: 4, ev_charger: 0, projector: 0, display: 0,
  electrical_outlet: 0, data_jack: 0, voice_jack: 0, combo_plate: 0, cable_term: 0,
};

export interface NetRow { id: string; label: string; typeId: DeviceTypeId; vlan: Vlan; ip: string; port: string; poeW: number }
export interface Schedule { rows: NetRow[]; vlans: Vlan[]; poeTotal: number; poePorts: number }

export function planSchedule(devices: Device[], switchPorts = 24): Schedule {
  const host: Record<string, number> = {};
  let portN = 0;
  const rows: NetRow[] = devices.map((d) => {
    const key = VLAN_FOR[d.typeId] || 'iot';
    const vlan = VLANS[key];
    host[key] = (host[key] ?? 9) + 1;
    const poe = POE_W[d.typeId] || 0;
    let port = '—';
    if (poe > 0) { const sw = Math.floor(portN / switchPorts) + 1; port = `SW${sw}/P${(portN % switchPorts) + 1}`; portN++; }
    return { id: d.id, label: d.label || DEVICE_REGISTRY[d.typeId].short, typeId: d.typeId, vlan, ip: `${vlan.subnet}.${host[key]}`, port, poeW: poe };
  });
  const ids = [...new Set(rows.map((r) => r.vlan.id))].sort((a, b) => a - b);
  const vlans = ids.map((id) => Object.values(VLANS).find((v) => v.id === id)!).filter(Boolean);
  return { rows, vlans, poeTotal: rows.reduce((s, r) => s + r.poeW, 0), poePorts: rows.filter((r) => r.poeW > 0).length };
}
