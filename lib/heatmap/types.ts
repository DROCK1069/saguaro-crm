/** Heatmap engine — shared types. Coordinates are floor-plan IMAGE PIXELS. */
import type { Pt } from './geometry';

export type Env = 'open' | 'office' | 'dense';
export type Band = '2.4' | '5' | '6';

export interface Scale { pxPerFt: number }

export type WallMaterialId =
  | 'drywall' | 'cubicle' | 'wood_door' | 'glass' | 'low_e_glass'
  | 'brick' | 'cinderblock' | 'concrete' | 'metal' | 'rack';

export interface Wall { id: string; a: Pt; b: Pt; material: WallMaterialId }

export type ModelType = 'rf' | 'radius' | 'fov' | 'spl' | 'camera';

/** Antenna radiation pattern (see lib/heatmap/antenna.ts). Omit → isotropic (legacy). */
export type AntennaPattern = 'omni' | 'patch' | 'directional' | 'sector';

/** A Wi-Fi network (SSID) in the DESIGN. Real design config — broadcast by every AP. */
export type SsidBand = '2.4' | '5' | '6' | 'all';
export type SsidSecurity = 'wpa2' | 'wpa3' | 'wpa2/3' | 'open';
export interface Ssid {
  name: string;
  vlanKey: string;                         // key into the VLANS map (e.g. 'wifi', 'guest', 'iot')
  band: SsidBand;
  security: SsidSecurity;
  hidden?: boolean;                        // SSID broadcast suppressed
}

export type DeviceTypeId =
  | 'wifi_ap' | 'camera'
  | 'motion_pir_ceiling' | 'motion_pir_wall'
  | 'smoke_detector_spot' | 'heat_detector_spot'
  | 'access_reader' | 'paging_speaker' | 'ble_beacon' | 'iot_gateway'
  | 'smart_switch' | 'smart_plug' | 'thermostat' | 'door_lock' | 'ev_charger' | 'projector' | 'display'
  // termination / rough-in markers (no coverage field — annotation only)
  | 'electrical_outlet' | 'data_jack' | 'voice_jack' | 'combo_plate' | 'cable_term';

/** A placed device instance. Per-device numerics seed from the registry default but are editable. */
export interface Device {
  id: string;
  typeId: DeviceTypeId;
  pos: Pt;
  label?: string;
  // RF (wifi_ap / ble_beacon / iot_gateway)
  band?: Band;
  txPowerDbm?: number;
  antennaGainDbi?: number;      // PEAK (boresight) antenna gain
  channel?: number;
  // ── directional antenna (optional; all omitted → isotropic, legacy byte-compatible) ──
  antennaPattern?: AntennaPattern; // omni (default) / patch / directional / sector
  azimuthDeg?: number;          // boresight azimuth the antenna points (0 = east, CCW+)
  downtiltDeg?: number;         // mechanical/electrical downtilt (deg below horizon)
  beamwidthDeg?: number;        // azimuth −3 dB beamwidth override (e.g. 30 / 60 / 90)
  // ── capacity / SINR inputs (optional; sane defaults when omitted) ──
  widthMhz?: number;            // operating channel width (20/40/80/160); default per band
  spatialStreams?: number;      // per-radio spatial streams (NSS); else from apModelId / default
  apModelId?: string;           // vendors.ts catalog id — seeds NSS from its streamCount
  // camera + fov sensors
  aimDeg?: number;          // 0 = east, CCW+
  hfovDeg?: number;         // camera horizontal FOV / sensor sector angle
  resolutionPx?: number;    // camera horizontal pixels
  coverageAngleDeg?: number;
  // radius / camera range override (ft)
  rangeFt?: number;
  // spl
  splRefDb?: number;
  wallBlocked?: boolean;    // override
  // termination / rough-in markers
  gang?: number;            // electrical_outlet receptacle count (2 / 4 / 6)
  ports?: number;           // data_jack / voice_jack port count (1 / 2 / 4)
  gender?: 'M' | 'F';       // cable_term connector: Plug (M) / Jack (F)
  // ── inspector identity/placement fields (optional, non-breaking) ──
  serial?: string;          // asset serial number (design record)
  firmware?: string;        // firmware / model rev noted at design time
  notes?: string;           // free-text install notes
  mountHeightFt?: number;   // mounting height above finished floor (ft)
  ipOverride?: string;      // override the schedule-assigned IP
  mac?: string;             // hardware MAC — installer fills in at commissioning
}

/** A real measured signal reading from a site survey / walk test (image-px coords). */
export interface MeasuredPoint {
  x: number;
  y: number;
  floorId?: string;
  /** measured RSSI in dBm at this point */
  measuredDbm: number;
  /** optional: id of the AP the client was associated to when measured */
  servingApId?: string;
}

export interface HeatmapProject {
  id: string;
  name: string;
  planDataUrl: string;
  imgW: number;
  imgH: number;
  scale: Scale | null;
  env: Env;
  walls: Wall[];
  devices: Device[];
  /** Building outline polygon (image px). When set, coverage % is masked to inside
   *  this polygon (real floor area) instead of the whole image bounding box. */
  boundary?: Pt[];
  /** Template-drawn rooms (native SVG templates render these directly; web draws to raster). */
  rooms?: { x: number; y: number; w: number; h: number; label?: string }[];
  /** Wi-Fi networks (SSIDs) in this design — broadcast by the placed APs. */
  ssids?: Ssid[];
  /** which device type's coverage the heatmap currently visualizes */
  activeType: DeviceTypeId;
  /** RF coverage target (dBm) for %-covered + auto-place + gaps */
  rssiTargetDbm: number;
  heatmapOpacity: number;
  /** site-survey walk-test readings for this floor — feeds calibrate.ts; persists with the design */
  measured?: MeasuredPoint[];
}

export interface CoverageCell {
  covered: boolean;
  value: number;
  color: string;
  rgba: [number, number, number];
  opacity: number;
  // ── additive RF fields (undefined for non-RF models & legacy consumers) ──
  sinrDb?: number;              // real SINR: signal / (Σ co-channel interferers + noise floor)
  snrDb?: number;               // signal / thermal-noise-floor only (no interferers)
  serverId?: string;            // id of the serving device at this cell
  // ── Wave 2 additive fields (undefined for non-RF / legacy consumers) ──
  secondaryDbm?: number;        // 2nd-strongest AP RSSI (dBm) — roaming / overlap headroom
  roamReady?: boolean;          // a client here can also hear a 2nd AP ≥ roam threshold (seamless roaming)
  confidence?: number;          // 0..1 prediction confidence (survey-derived); undefined = not evaluated
}

export interface GapRegion { area: number; centroid: Pt; bbox: { x: number; y: number; w: number; h: number }; worst: number }

export interface CoverageResult {
  cols: number;
  rows: number;
  cellPx: number;
  /** flat row-major; null = outside plan / no value */
  cells: (CoverageCell | null)[];
  bandLabels: { label: string; color: string }[];
  stats: CoverageStats;
  gaps: GapRegion[];
}

export interface CoverageStats {
  activeType: DeviceTypeId;
  deviceCount: number;
  insideCells: number;
  coveredCells: number;
  pctCovered: number;          // % of plan meeting the target/covered band
  avgValue: number;            // avg dBm (rf) / avg px-per-m (camera) / avg dB (spl) / avg %range
  valueUnit: string;
  healthScore: number;         // 0-100
  deadZones: number;           // count of gap regions
  deadArea: number;            // ft²
  // ── additive SINR summary (RF only; undefined otherwise) ──
  avgSinrDb?: number;          // mean SINR over valued RF cells
  minSinrDb?: number;          // worst SINR over valued RF cells
  interferedCells?: number;    // covered cells materially degraded by co-channel interference
  // ── Wave 2 additive summaries (Wi-Fi only; undefined otherwise) ──
  roamReadyCells?: number;     // covered cells that can also reach a 2nd AP (roam-ready)
  roamReadyPct?: number;       // roamReadyCells / coveredCells × 100
  avgConfidence?: number;      // mean per-cell prediction confidence 0..1 (only when a survey exists)
}
