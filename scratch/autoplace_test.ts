// Proof that autoPlaceAPs geometry RESPECTS the passed radio (the mobile bug: it used the
// default U7 for spacing and only re-tagged after). Same algorithm now in web + mobile smart.ts.
//   npx esbuild scratch/autoplace_test.ts --bundle --platform=node --format=cjs | node
import { autoPlaceAPs } from '../lib/heatmap/smart';
import type { HeatmapProject } from '../lib/heatmap/types';

const base: HeatmapProject = {
  name: 'test', env: 'office', imgW: 1200, imgH: 900, planDataUrl: '',
  scale: { pxPerFt: 8 }, rssiTargetDbm: -67, activeType: 'wifi_ap',
  devices: [], walls: [],
} as unknown as HeatmapProject;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n); } };

// Weak radio (low EIRP) → smaller footprints → MORE APs required than a strong radio.
const weak = autoPlaceAPs(base, { targetPct: 0.9, band: '5', txPowerDbm: 6, antennaGainDbi: 2, label: 'Weak-AP' });
const strong = autoPlaceAPs(base, { targetPct: 0.9, band: '5', txPowerDbm: 26, antennaGainDbi: 6, label: 'Strong-AP' });
const dflt = autoPlaceAPs(base, { targetPct: 0.9 }); // UniFi default path (unchanged behavior)

console.log(`weak APs=${weak.aps.length}  strong APs=${strong.aps.length}  default APs=${dflt.aps.length}`);
ok('weak radio needs MORE APs than strong radio (geometry uses the passed radio)', weak.aps.length > strong.aps.length);
ok('placed APs carry the passed TX power (not a default)', weak.aps.every((a) => a.txPowerDbm === 6));
ok('placed APs carry the passed antenna gain', weak.aps.every((a) => a.antennaGainDbi === 6 ? false : a.antennaGainDbi === 2));
ok('placed APs carry the passed label', strong.aps.every((a) => a.label === 'Strong-AP'));
ok('default (no override) path still returns a valid placement', dflt.aps.length > 0 && dflt.aps.every((a) => typeof a.txPowerDbm === 'number'));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
