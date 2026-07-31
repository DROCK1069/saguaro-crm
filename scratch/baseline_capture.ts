// Capture a legacy-field baseline of the CURRENT engine for omni / no-co-channel scenarios.
// These are exactly the scenarios where the improved engine MUST stay byte-compatible.
//   npx esbuild scratch/baseline_capture.ts --bundle --platform=node --format=cjs | node
import { computeCoverage } from '../lib/heatmap/engine';
import type { HeatmapProject, Device, CoverageResult } from '../lib/heatmap/types';
import * as fs from 'fs';

const mk = (over: Partial<HeatmapProject>): HeatmapProject => ({
  id: 'p', name: 't', planDataUrl: '', imgW: 420, imgH: 320,
  scale: { pxPerFt: 8 }, env: 'office', walls: [], devices: [],
  activeType: 'wifi_ap', rssiTargetDbm: -67, heatmapOpacity: 0.6,
  ...over,
});

const ap = (id: string, x: number, y: number, extra: Partial<Device> = {}): Device => ({
  id, typeId: 'wifi_ap', pos: { x, y }, band: '5', txPowerDbm: 20, antennaGainDbi: 3, ...extra,
});

const scenarios: { name: string; p: HeatmapProject }[] = [
  { name: 'single-omni-nochannel', p: mk({ devices: [ap('a1', 210, 160)] }) },
  { name: 'single-omni-channel36', p: mk({ devices: [ap('a1', 210, 160, { channel: 36 })] }) },
  // two APs on DIFFERENT channels — old code applies NO co-channel penalty here.
  { name: 'two-omni-diff-channels', p: mk({ devices: [ap('a1', 120, 160, { channel: 36 }), ap('a2', 300, 160, { channel: 40 })] }) },
  // walls + a couple omni APs, still different channels.
  { name: 'walls-two-omni-diff', p: mk({
      walls: [{ id: 'w1', a: { x: 210, y: 0 }, b: { x: 210, y: 320 }, material: 'concrete' }],
      devices: [ap('a1', 120, 160, { channel: 36 }), ap('a2', 300, 160, { channel: 149 })],
    }) },
];

const project = (r: CoverageResult) => ({
  stats: r.stats,
  cells: r.cells.map((c) => (c ? { covered: c.covered, value: c.value, color: c.color, rgba: c.rgba, opacity: c.opacity } : null)),
});

const out = scenarios.map((s) => ({ name: s.name, ...project(computeCoverage(s.p, 10)) }));
fs.writeFileSync(__dirname + '/baseline_omni.json', JSON.stringify(out));
console.log('baseline written:', out.map((o) => `${o.name}(cells=${o.cells.length},cov=${o.stats.coveredCells},health=${o.stats.healthScore})`).join('  '));
