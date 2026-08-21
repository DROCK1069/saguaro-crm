/**
 * Heatmap engine — camera AUTO-DESIGNER (mirror of smart.ts autoPlaceAPs, for cameras).
 * Places the minimum cameras for full DORI coverage per room, respecting field-of-view,
 * line-of-sight (walls block a camera), and mount height (a ceiling dome sees the floor
 * beneath it — no false blind spot under the camera). Bathrooms are auto-excluded (privacy).
 *
 * Pure + self-contained: depends only on geometry primitives + the DORI model already in
 * models.ts. Adds NO coupling to existing code — safe to ship dormant until wired to a button.
 */
import type { HeatmapProject, Device } from './types';
import { dist, angleDeg, angleDiff, crossings, type Pt } from './geometry';
import { doriDistanceFt, FT_PER_M } from './models';

let _cc = 0;
const cuid = () => `cam_auto_${Date.now().toString(36)}_${_cc++}`;

export interface CameraAutoOpts {
  /** horizontal field of view (deg) — 102 ≈ 2.8mm ultra-wide, good for corner mounts */
  hfovDeg?: number;
  /** horizontal sensor resolution (px) — 3840 ≈ 4K/4MP-class */
  resolutionPx?: number;
  /** mount height above finished floor (ft) — a ceiling dome sees the nadir disc below it */
  mountHeightFt?: number;
  /** DORI pixel-density that counts as "covered" (px/m): 25=Detect · 125=Recognize · 250=Identify */
  minPxPerM?: number;
  /** fraction of a room that must be covered before we stop adding cameras (0..1) */
  targetPct?: number;
  /** never exceed this many cameras in one room */
  maxPerRoom?: number;
  /** room labels to skip entirely (privacy/legal) — matched case-insensitively as substrings */
  excludeLabels?: string[];
}

export interface CameraAutoRoom { label: string; count: number; coveragePct: number; excluded?: boolean }
export interface CameraAutoResult { cameras: Device[]; rooms: CameraAutoRoom[]; totalCameras: number }

const DEFAULT_EXCLUDE = ['toilet', 'restroom', 'bath', 'wc', 'lavatory'];

/** px/m a camera resolves at `cell`, accounting for FOV, LOS (walls) and MOUNT HEIGHT. 0 = not seen. */
function cameraPxAt(cell: Pt, cam: Device, p: HeatmapProject, mountFt: number): number {
  const pxPerFt = p.scale?.pxPerFt ?? 1;
  const hfov = cam.hfovDeg ?? 102;
  const hpx = cam.resolutionPx ?? 3840;
  const aim = cam.aimDeg ?? 0;
  const detectFt = doriDistanceFt(hpx, hfov, 25);
  const dFt = dist(cell, cam.pos) / pxPerFt;
  if (dFt > detectFt) return 0;
  if (crossings(cell, cam.pos, p.walls).length > 0) return 0;           // walls always block a camera
  const nadirFt = mountFt > 0 ? mountFt * 1.7 : 0;                       // dome sees straight down within the nadir disc
  if (dFt > nadirFt && angleDiff(angleDeg(cam.pos, cell), aim) > hfov / 2) return 0;
  const slantM = Math.hypot(dFt, mountFt) / FT_PER_M;                    // true 3D distance incl. ceiling height
  return hpx / (2 * Math.max(slantM, 0.3) * Math.tan((hfov * Math.PI) / 180 / 2));
}

/**
 * Auto-place cameras for every room in `p.rooms` (falls back to the whole footprint when no rooms
 * are known). Returns the camera devices ready to add to the project, plus a per-room coverage
 * summary. Requires a calibrated scale; returns empty when unscaled.
 */
export function autoPlaceCameras(p: HeatmapProject, opts: CameraAutoOpts = {}): CameraAutoResult {
  const hfovDeg = opts.hfovDeg ?? 102;
  const resolutionPx = opts.resolutionPx ?? 3840;
  const mountHeightFt = opts.mountHeightFt ?? 9;
  const minPxPerM = opts.minPxPerM ?? 25;
  const targetPct = opts.targetPct ?? 0.98;
  const maxPerRoom = opts.maxPerRoom ?? 3;
  const exclude = (opts.excludeLabels ?? DEFAULT_EXCLUDE).map((s) => s.toLowerCase());

  if (!p.scale || !(p.scale.pxPerFt > 0)) return { cameras: [], rooms: [], totalCameras: 0 };
  const F = p.scale.pxPerFt;

  // rooms: prefer detected rooms; else one room = the whole plan bounding box
  const roomRects = (p.rooms && p.rooms.length)
    ? p.rooms.map((r) => ({ label: r.label ?? 'Area', x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }))
    : [{ label: 'Area', x0: 0, y0: 0, x1: p.imgW, y1: p.imgH }];

  const deg = (from: Pt, to: Pt) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const cameras: Device[] = [];
  const rooms: CameraAutoRoom[] = [];

  for (const rm of roomRects) {
    const label = rm.label;
    if (exclude.some((e) => label.toLowerCase().includes(e))) { rooms.push({ label, count: 0, coveragePct: 0, excluded: true }); continue; }
    const cx = (rm.x0 + rm.x1) / 2, cy = (rm.y0 + rm.y1) / 2, C = { x: cx, y: cy };
    const inset = 1.3 * F;                                               // mount ~1.3ft off the walls
    const mounts: Pt[] = [
      { x: rm.x0 + inset, y: rm.y0 + inset }, { x: rm.x1 - inset, y: rm.y0 + inset },
      { x: rm.x1 - inset, y: rm.y1 - inset }, { x: rm.x0 + inset, y: rm.y1 - inset },
      { x: cx, y: rm.y0 + inset }, { x: cx, y: rm.y1 - inset },
      { x: rm.x0 + inset, y: cy }, { x: rm.x1 - inset, y: cy },
    ];
    const cands: Device[] = mounts.map((pos) => ({
      id: cuid(), typeId: 'camera', pos, aimDeg: deg(pos, C), hfovDeg, resolutionPx, mountHeightFt, label: 'Camera',
    }));
    // sample the room interior (~0.8ft grid)
    const grid: Pt[] = [];
    const step = Math.max(0.6 * F, 8);
    for (let x = rm.x0 + step / 2; x < rm.x1; x += step) for (let y = rm.y0 + step / 2; y < rm.y1; y += step) grid.push({ x, y });
    if (!grid.length) { rooms.push({ label, count: 0, coveragePct: 0 }); continue; }

    const covered = new Array(grid.length).fill(false);
    const chosen: Device[] = [];
    while (chosen.length < maxPerRoom) {
      const done = covered.filter(Boolean).length / grid.length;
      if (done >= targetPct) break;
      let best = -1, bestGain = 0;
      for (let i = 0; i < cands.length; i++) {
        if (chosen.includes(cands[i])) continue;
        let gain = 0;
        for (let g = 0; g < grid.length; g++) if (!covered[g] && cameraPxAt(grid[g], cands[i], p, mountHeightFt) >= minPxPerM) gain++;
        if (gain > bestGain) { bestGain = gain; best = i; }
      }
      if (best < 0 || bestGain === 0) break;
      chosen.push(cands[best]);
      for (let g = 0; g < grid.length; g++) if (!covered[g] && cameraPxAt(grid[g], cands[best], p, mountHeightFt) >= minPxPerM) covered[g] = true;
    }
    cameras.push(...chosen);
    rooms.push({ label, count: chosen.length, coveragePct: 100 * covered.filter(Boolean).length / grid.length });
  }

  return { cameras, rooms, totalCameras: cameras.length };
}
