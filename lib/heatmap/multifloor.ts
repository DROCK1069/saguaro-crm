/**
 * Multi-floor support for the Coverage Heatmap.
 * A building is a list of Floors, each holding its own HeatmapProject (plan, scale,
 * walls, devices, boundary). This module aggregates per-floor coverage + BOM into a
 * single building-wide summary for the GC report and the bid jacket.
 *
 * Deterministic, DOM-free — shared by web, iOS, and the estimator.
 */
import type { HeatmapProject } from './types';
import { recompute } from './smart';
import { computeBom, type BomResult } from './bom';

export interface Floor {
  id: string;
  name: string;
  /** null until a plan is uploaded for this floor */
  project: HeatmapProject | null;
}

export interface FloorStat {
  id: string;
  name: string;
  hasPlan: boolean;
  hasScale: boolean;
  areaFt2: number;
  deviceCount: number;
  apCount: number;
  cameraCount: number;
  coveragePct: number;   // WiFi %-covered on this floor (0 if no scale/devices)
  healthScore: number;
  deadZones: number;
  deadAreaFt2: number;
}

export interface BuildingSummary {
  floors: FloorStat[];
  floorCount: number;
  floorsWithPlan: number;
  totalDevices: number;
  totalAps: number;
  totalCameras: number;
  totalAreaFt2: number;
  /** floor-area-weighted average WiFi coverage across the building */
  avgCoveragePct: number;
  totalDeadZones: number;
  totalDeadAreaFt2: number;
  /** combined bill of materials over every device on every floor */
  bom: BomResult;
}

let _fid = 0;
export function newFloor(name: string): Floor {
  return { id: `floor_${Date.now().toString(36)}_${_fid++}`, name, project: null };
}

/** floor plan area in ft² (0 if the floor has no scale set). */
export function floorAreaFt2(p: HeatmapProject | null): number {
  if (!p || !p.scale) return 0;
  return (p.imgW * p.imgH) / (p.scale.pxPerFt * p.scale.pxPerFt);
}

function statFor(f: Floor): FloorStat {
  const p = f.project;
  const base: FloorStat = {
    id: f.id, name: f.name, hasPlan: !!p, hasScale: !!p?.scale, areaFt2: Math.round(floorAreaFt2(p)),
    deviceCount: p?.devices.length ?? 0,
    apCount: p?.devices.filter((d) => d.typeId === 'wifi_ap').length ?? 0,
    cameraCount: p?.devices.filter((d) => d.typeId === 'camera').length ?? 0,
    coveragePct: 0, healthScore: 0, deadZones: 0, deadAreaFt2: 0,
  };
  if (!p || !p.scale || p.devices.filter((d) => d.typeId === 'wifi_ap').length === 0) return base;
  // coverage is computed for the WiFi layer regardless of the floor's active layer
  const res = recompute({ ...p, activeType: 'wifi_ap' }, 12);
  base.coveragePct = Math.round(res.stats.pctCovered * 10) / 10;
  base.healthScore = res.stats.healthScore;
  base.deadZones = res.stats.deadZones;
  base.deadAreaFt2 = Math.round(res.stats.deadArea);
  return base;
}

/** Aggregate every floor into one building-wide summary (coverage, devices, BOM). */
export function summarizeBuilding(floors: Floor[]): BuildingSummary {
  const stats = floors.map(statFor);
  const withPlan = stats.filter((s) => s.hasPlan);
  const allDevices = floors.flatMap((f) => f.project?.devices ?? []);

  // floor-area-weighted average coverage (floors with a scale + APs only)
  let wSum = 0, wArea = 0;
  for (const s of stats) {
    if (s.hasScale && s.apCount > 0 && s.areaFt2 > 0) { wSum += s.coveragePct * s.areaFt2; wArea += s.areaFt2; }
  }
  const avgCoveragePct = wArea > 0 ? Math.round((wSum / wArea) * 10) / 10 : 0;

  return {
    floors: stats,
    floorCount: floors.length,
    floorsWithPlan: withPlan.length,
    totalDevices: allDevices.length,
    totalAps: allDevices.filter((d) => d.typeId === 'wifi_ap').length,
    totalCameras: allDevices.filter((d) => d.typeId === 'camera').length,
    totalAreaFt2: stats.reduce((s, f) => s + f.areaFt2, 0),
    avgCoveragePct,
    totalDeadZones: stats.reduce((s, f) => s + f.deadZones, 0),
    totalDeadAreaFt2: stats.reduce((s, f) => s + f.deadAreaFt2, 0),
    bom: computeBom(allDevices),
  };
}
