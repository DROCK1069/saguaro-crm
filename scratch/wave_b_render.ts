// Wave B deliverable render. Run:
//   npx esbuild scratch/wave_b_render.ts --bundle --platform=node --format=cjs | node
import * as fs from 'fs';
import { computeTakeoff, type Condition, type ComputeOpts } from '../lib/takeoff';
import { buildEstimateReportHtml } from '../lib/takeoff/estimate-report';

const conditions: Condition[] = [
  { id: 'c1', name: 'Interior partitions', kind: 'linear', value: 420, heightFt: 9, assemblyId: 'interior_partition', building: 'A', level: '1', instanceCount: 1 },
  { id: 'c2', name: 'Slab on grade', kind: 'area', value: 3200, thicknessIn: 6, assemblyId: 'slab_on_grade', building: 'A', level: '1' },
  { id: 'c3', name: 'Restroom partitions (typical)', kind: 'count', value: 3, assemblyId: 'wood_door', building: 'A', level: '2', instanceCount: 4 },
  { id: 'c4', name: 'Level 2 finishes', kind: 'area', value: 2800, assemblyId: 'batt_insulation', building: 'A', level: '2' },
  { id: 'a1', name: 'Upgrade to LVT flooring', kind: 'area', value: 2800, assemblyId: 'flooring_lvt', alternate: 'Upgrade lobby flooring to LVT', alternateType: 'add' },
  { id: 'd1', name: 'Delete storefront glazing', kind: 'area', value: 240, assemblyId: 'aluminum_storefront', alternate: 'Delete north storefront', alternateType: 'deduct' },
] as never;
// fall back if a flooring assembly id is absent
const opts: ComputeOpts = { overheadPct: 10, profitPct: 8, contingencyPct: 5, laborBurdenPct: 30, salesTaxPct: 7.5, generalConditionsPct: 8, regionMultiplier: 1.04, regionLabel: 'Phoenix, AZ · CCI 1.04' };

const result = computeTakeoff(conditions, opts);
const html = buildEstimateReportHtml({
  project: { name: 'Copper Ridge Retail — Building A', buildingSf: 6000, location: 'Phoenix, AZ', client: 'Copper State Developments' },
  conditions, result, opts,
  company: { name: 'Copper State Developments', tagline: 'Control Every Project. Deliver Every Promise.', contact: 'estimating@copperstate.dev · (602) 555-0142', license: 'ROC #334102' },
  accuracyClass: 3,
  allowances: ['$25,000 allowance for owner-selected light fixtures', '$10,000 allowance for signage'],
  clarifications: ['Excludes work below finished floor except as shown.', 'Assumes concrete pump access on the north side.'],
  exclusions: ['Permits and impact fees', 'Testing & special inspection', 'Winter conditions'],
});
fs.writeFileSync('scratch/wave_b_estimate.html', html);
console.log('base sell $:', (result.sellCents / 100).toLocaleString());
console.log('alternates:', result.alternates.map((a) => `${a.label} [${a.type}] ${(a.deltaCents / 100).toFixed(0)}`));
console.log('byLocation:', result.byLocation.map((l) => `${l.building}/${l.level}: $${(l.totalCents / 100).toFixed(0)}`));
console.log('has accuracy range:', /Expected range/.test(html), '| alternates section:', /Base Bid &amp; Alternates|Base Bid & Alternates/.test(html), '| location section:', /Cost by Location/.test(html), '| Net col:', />Net<\/th>/.test(html));
console.log('wrote scratch/wave_b_estimate.html');
