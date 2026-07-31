/** Accuracy / sanity engine — deterministic checks that flag risky estimates. */
import type { Condition, ComputeOpts, LineItem, SanityFlag } from './types';
import { COST_CATALOG } from './cost';
import { ASSEMBLIES } from './assemblies';

/**
 * Sane per-costKey unit-cost windows in [minCents, maxCents] — catches fat-fingered
 * tenant overrides and stale catalog rates. A missing key = no band check (opt-in).
 */
export const COST_BANDS: Record<string, [number, number]> = {
  concrete_cy: [12000, 28000], rebar_lb: [60, 180], drywall_sf: [70, 220], metal_stud_ea: [600, 2200],
  steel_column_ea: [40000, 180000], steel_beam_lb: [80, 260], tpo_sf: [120, 400], hvac_sf: [1200, 4000],
  electrical_sf: [600, 2500], fire_sprinkler_sf: [200, 700], flooring_sf: [250, 1200], door_frame_ea: [50000, 180000],
  aluminum_storefront_sf: [5000, 15000], plumbing_fixture_ea: [30000, 120000], acoustic_ceiling_sf: [200, 700],
  brick_veneer_sf: [400, 1000], bar_joist_lf: [500, 1600], excavation_cy: [500, 2000], agg_base_cy: [2000, 5000],
  asphalt_paving_sf: [250, 800], wood_door_ea: [25000, 90000], carpet_tile_sy: [1500, 5000], light_fixture_ea: [8000, 60000],
  vct_sf: [120, 400], lvt_sf: [200, 700], data_drop_ea: [9000, 35000], sprinkler_head_ea: [8000, 35000],
  plumbing_rough_ea: [25000, 100000], toilet_partition_ea: [25000, 90000],
  // ---- v3: bands completed to EVERY catalog key (a lint test fails on any un-banded key) ----
  vapor_barrier_sf: [12, 60], formwork_sf: [200, 600], cmu_ea: [180, 600], anchor_bolt_set: [2000, 8000],
  track_lf: [80, 300], insulation_sf: [40, 160], finish_sf: [30, 120], paint_sf: [35, 160],
  door_hardware_set: [20000, 90000], rigid_insul_sf: [80, 320], cmu_wall_ea: [200, 650], grout_cy: [10000, 32000],
  curb_gutter_lf: [500, 1800], wwm_sf: [18, 90], metal_deck_sf: [180, 700], roof_deck_sf: [140, 500],
  pier_drill_ea: [20000, 100000], masonry_tie_ea: [20, 120], wood_stud_ea: [250, 900], wood_plate_lf: [50, 220],
  sheathing_sf: [70, 300], osb_sheathing_sf: [40, 180], wrb_sf: [15, 90], batt_r19_sf: [45, 200],
  spray_foam_sf: [150, 650], mod_bit_sf: [160, 700], waterproofing_sf: [120, 600], sealant_lf: [20, 120],
  alum_window_sf: [3000, 12000], ceramic_tile_sf: [350, 1400], tile_setting_sf: [60, 300], conc_seal_sf: [60, 300],
  wall_base_lf: [60, 300], wallcovering_sf: [110, 500], toilet_accessory_ea: [6000, 30000], device_ea: [180, 900],
};

/** Catalog keys that lack a sane band — the lint test fails when this is non-empty. */
export function unbandedCatalogKeys(): string[] {
  return Object.keys(COST_CATALOG).filter((k) => !COST_BANDS[k]);
}

/**
 * @param conditions optional — enables measurement-level checks (zero-scale/no-trace).
 *                   Omit for v1 back-compat; existing callers keep working unchanged.
 */
export function runSanity(lines: LineItem[], subtotalCents: number, opts: ComputeOpts, conditions?: Condition[]): SanityFlag[] {
  const flags: SanityFlag[] = [];
  const trades = new Set(lines.map((l) => l.trade));
  const has = (t: string) => trades.has(t);
  const key = (k: string) => lines.some((l) => l.costKey === k);

  // ---- cross-trade coverage gaps (existing) ----
  if (has('Drywall') && !has('Framing')) flags.push({ level: 'warn', code: 'gwb_no_framing', message: 'Drywall present with no framing — add stud/track scope?' });
  if (has('Concrete') && !lines.some((l) => l.trade === 'Concrete' && /rebar|reinforc/i.test(l.name))) flags.push({ level: 'warn', code: 'concrete_no_rebar', message: 'Concrete present with no reinforcing.' });
  if (has('Openings') && !lines.some((l) => /hardware/i.test(l.name))) flags.push({ level: 'info', code: 'door_no_hw', message: 'Doors present — confirm hardware sets.' });

  // ---- v2 division-coverage gaps ----
  if (lines.some((l) => l.assemblyId === 'slab_on_grade' || l.assemblyId === 'slab_on_grade_heavy') && !key('vapor_barrier_sf'))
    flags.push({ level: 'warn', code: 'slab_no_vapor', message: 'Slab-on-grade without vapor barrier.' });
  if (lines.some((l) => /roof/.test(l.assemblyId)) && !lines.some((l) => /insul/i.test(l.name)))
    flags.push({ level: 'warn', code: 'roof_no_insul', message: 'Roofing without insulation.' });
  if (lines.some((l) => l.assemblyId === 'exterior_stud_wall') && !key('wrb_sf'))
    flags.push({ level: 'warn', code: 'ext_wall_no_wrb', message: 'Exterior wall without WRB.' });

  // ---- zero / negative quantities (existing) ----
  const bad = lines.filter((l) => !(l.qty > 0));
  if (bad.length) flags.push({ level: 'warn', code: 'zero_qty', message: `${bad.length} line(s) have a non-positive quantity.` });

  // ---- no scale / zero measurement (needs conditions) ----
  for (const c of conditions ?? [])
    if (!(c.value > 0)) flags.push({ level: 'warn', code: 'zero_measure', message: `Condition "${c.name}" has no measured value — set scale / trace geometry.` });

  // ---- height-dependent assembly with NO wall height set ----
  // Without a height, drywall/insul/finish/framing are priced by raw length instead of wall area
  // (a ~9-20× under-bid that otherwise ships looking like a normal line). Flag it loudly.
  for (const c of conditions ?? []) {
    const asm = ASSEMBLIES[c.assemblyId];
    if (asm && asm.components.some((comp) => comp.useHeight || comp.qtyFormula === 'studCount') && !(c.heightFt && c.heightFt > 0))
      flags.push({ level: 'warn', code: 'missing_height', message: `Condition "${c.name}" uses a wall assembly but has no height — drywall/finish/framing are priced by length, not wall area (major under-bid). Set the wall height.` });
  }

  // ---- missing markups ----
  if (opts.overheadPct == null && opts.profitPct == null)
    flags.push({ level: 'warn', code: 'no_markup', message: 'No overhead/profit applied — this is raw cost, not a bid.' });
  if (opts.salesTaxPct == null)
    flags.push({ level: 'info', code: 'no_tax', message: 'No sales tax on material.' });
  if (opts.bondPct == null)
    flags.push({ level: 'info', code: 'no_bond', message: 'No P&P bond in the number — confirm bonding required.' });

  // ---- unit-cost band per costKey (catches fat-fingered tenant overrides) ----
  for (const l of lines) {
    const b = COST_BANDS[l.costKey];
    if (b && (l.unitMaterialCents < b[0] || l.unitMaterialCents > b[1]))
      flags.push({ level: 'warn', code: 'rate_out_of_band', message: `${l.name}: $${(l.unitMaterialCents / 100).toFixed(2)}/${l.unit} is outside sane band $${b[0] / 100}–$${b[1] / 100}.` });
  }

  // ---- $/SF variance vs history (existing) ----
  if (opts.buildingSf && opts.buildingSf > 0 && opts.historicalCostPerSf && opts.historicalCostPerSf > 0) {
    const psf = subtotalCents / 100 / opts.buildingSf;
    const dev = Math.abs(psf - opts.historicalCostPerSf) / opts.historicalCostPerSf;
    if (dev > 0.25) flags.push({ level: 'warn', code: 'psf_variance', message: `$/SF is ${psf.toFixed(0)} vs your historical ${opts.historicalCostPerSf.toFixed(0)} (${Math.round(dev * 100)}% off).` });
  }

  // ---- $/SF plausibility band ----
  if (opts.buildingSf && opts.buildingSf > 0) {
    const [lo, hi] = opts.costPerSfBand ?? [8000, 60000]; // $80–$600/SF in cents
    const psf = Math.round(subtotalCents / opts.buildingSf);
    if (psf < lo || psf > hi)
      flags.push({ level: 'warn', code: 'psf_implausible', message: `$${(psf / 100).toFixed(0)}/SF is outside the plausible commercial band $${lo / 100}–$${hi / 100}.` });
  }

  return flags;
}
