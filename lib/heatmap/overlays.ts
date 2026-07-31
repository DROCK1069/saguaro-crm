/** Track-3 pro overlays: RSSI iso-contours + grounded co-channel interference. */
import type { CoverageResult, HeatmapProject } from './types';
import { apRssiAt } from './engine';

export interface Seg { x1: number; y1: number; x2: number; y2: number }

/**
 * Marching-squares iso-lines over the coverage grid at a dBm threshold.
 * `sx`/`sy` map a grid column/row to the full-res image (drawImage stretches
 * cols×rows across imgW×imgH, so a grid node sits at (c+0.5)·sx, (r+0.5)·sy).
 * Returns segments already in image-pixel space.
 */
export function isoLines(cov: CoverageResult, threshold: number, sx: number, sy: number): Seg[] {
  const { cols, rows, cells } = cov;
  const val = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return -200;
    const cell = cells[r * cols + c];
    return cell ? cell.value : -200;
  };
  const fx = (gc: number) => (gc + 0.5) * sx;
  const fy = (gr: number) => (gr + 0.5) * sy;
  const segs: Seg[] = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const tl = val(c, r), tr = val(c + 1, r), br = val(c + 1, r + 1), bl = val(c, r + 1);
    let idx = 0;
    if (tl > threshold) idx |= 8;
    if (tr > threshold) idx |= 4;
    if (br > threshold) idx |= 2;
    if (bl > threshold) idx |= 1;
    if (idx === 0 || idx === 15) continue;
    const t = (a: number, b: number) => (threshold - a) / ((b - a) || 1e-6);
    const top = () => ({ x: fx(c + t(tl, tr)), y: fy(r) });
    const right = () => ({ x: fx(c + 1), y: fy(r + t(tr, br)) });
    const bottom = () => ({ x: fx(c + t(bl, br)), y: fy(r + 1) });
    const left = () => ({ x: fx(c), y: fy(r + t(tl, bl)) });
    const push = (a: { x: number; y: number }, b: { x: number; y: number }) => segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    switch (idx) {
      case 1: case 14: push(left(), bottom()); break;
      case 2: case 13: push(bottom(), right()); break;
      case 3: case 12: push(left(), right()); break;
      case 4: case 11: push(top(), right()); break;
      case 5: push(left(), top()); push(bottom(), right()); break;
      case 6: case 9: push(top(), bottom()); break;
      case 7: case 8: push(left(), top()); break;
      case 10: push(top(), right()); push(left(), bottom()); break;
    }
  }
  return segs;
}

export interface InterferenceMask { mask: Uint8Array; cols: number; rows: number }

/**
 * Co-channel interference: a cell is flagged where the serving AP and a
 * second AP ON THE SAME CHANNEL are both strong (> −82 dBm) and within ~8 dB
 * of each other — the classic low-SIR overlap that kills WiFi throughput.
 * Grounded in the same path-loss model as the heatmap (apRssiAt).
 */
export function interferenceMask(p: HeatmapProject, cov: CoverageResult): InterferenceMask | null {
  if (!p.scale) return null;
  const aps = p.devices.filter((d) => d.typeId === 'wifi_ap');
  if (aps.length < 2) return null;
  const { cols, rows } = cov;
  const sx = p.imgW / cols, sy = p.imgH / rows;
  const mask = new Uint8Array(cols * rows);
  let any = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = cov.cells[r * cols + c];
    if (!cell) continue;
    const pt = { x: (c + 0.5) * sx, y: (r + 0.5) * sy };
    const per = aps.map((a) => ({
      ch: a.channel ?? 36,
      rssi: apRssiAt(pt, a.pos, p, a.band ?? '5', (a.txPowerDbm ?? 15) + (a.antennaGainDbi ?? 3)),
    })).sort((x, y) => y.rssi - x.rssi);
    const serve = per[0];
    if (serve.rssi < -78) continue;
    const co = per.slice(1).find((a) => a.ch === serve.ch);
    if (co && co.rssi > -82 && serve.rssi - co.rssi < 8) { mask[r * cols + c] = 1; any = true; }
  }
  return any ? { mask, cols, rows } : null;
}
