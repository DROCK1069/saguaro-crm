/**
 * CSI-line → engine costKey resolver.
 *
 * The measured takeoff path already knows every line's `costKey` (it comes from the
 * assembly components) so it can look a tenant rate up directly. The AI blueprint path
 * does NOT — the model returns a CSI code + unit + free-text description. This module
 * bridges the two DETERMINISTICALLY so the AI takeoff can be re-priced with the GC's
 * own learned/manual rates (lib/takeoff/cost.ts COST_CATALOG + cost_rates).
 *
 * Strategy (conservative — a wrong match would mis-price a line, so we only resolve
 * when we're confident, otherwise return null and the caller keeps the model's rate):
 *   1. Key on (2-digit CSI division | normalized unit). This pair alone uniquely
 *      identifies a costKey for most catalog entries.
 *   2. Where a (division|unit) bucket holds several costKeys, disambiguate with
 *      keyword hits against the line's name+description. No keyword hit → null.
 *
 * The (division|unit) → costKey table and the keyword sets below are derived from the
 * ASSEMBLIES component table in ./assemblies.ts. Keep them in sync if assemblies change.
 */

/** Normalize a free-form unit token to the catalog vocabulary (SF, LF, CY, SY, EA, LB). */
export function normalizeUnit(raw: string): string {
  const u = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  switch (u) {
    case 'SF': case 'SQFT': case 'SQF': case 'SQ': case 'SFT': case 'SQUAREFEET': case 'SQUAREFOOT': return 'SF';
    case 'LF': case 'LNFT': case 'LINFT': case 'LFT': case 'LNF': case 'LINEARFEET': case 'LINEALFEET': return 'LF';
    case 'CY': case 'CUYD': case 'CUYDS': case 'CYD': case 'CUBICYARD': case 'CUBICYARDS': return 'CY';
    case 'SY': case 'SQYD': case 'SYD': case 'SQUAREYARD': case 'SQUAREYARDS': return 'SY';
    case 'LB': case 'LBS': case 'POUND': case 'POUNDS': return 'LB';
    case 'EA': case 'EACH': case 'EACHES': case 'UNIT': case 'UNITS': case 'NO': case 'CT': return 'EA';
    default: return u;
  }
}

/**
 * (division|unit) → candidate costKeys, most-specific first. Single-element buckets
 * resolve unconditionally; multi-element buckets require a keyword hit to disambiguate.
 */
const CANDIDATES: Record<string, string[]> = {
  // 03 Concrete
  '03|CY': ['concrete_cy'],
  '03|LB': ['rebar_lb'],
  '03|SF': ['conc_seal_sf', 'wwm_sf', 'formwork_sf'],
  // 04 Masonry
  '04|CY': ['grout_cy'],
  '04|LB': ['rebar_lb'],
  '04|SF': ['brick_veneer_sf'],
  '04|EA': ['cmu_wall_ea', 'masonry_tie_ea'],
  // 05 Metals
  '05|LB': ['steel_beam_lb'],
  '05|EA': ['steel_column_ea', 'anchor_bolt_set', 'metal_stud_ea'],
  '05|LF': ['bar_joist_lf', 'track_lf'],
  '05|SF': ['roof_deck_sf', 'metal_deck_sf'],
  // 06 Wood & Plastics
  '06|EA': ['wood_stud_ea'],
  '06|LF': ['wood_plate_lf'],
  '06|SF': ['osb_sheathing_sf', 'sheathing_sf'],
  // 07 Thermal & Moisture
  '07|LF': ['sealant_lf'],
  '07|SF': ['tpo_sf', 'mod_bit_sf', 'spray_foam_sf', 'rigid_insul_sf', 'batt_r19_sf', 'waterproofing_sf', 'vapor_barrier_sf', 'wrb_sf', 'insulation_sf'],
  // 08 Openings
  '08|EA': ['wood_door_ea', 'door_hardware_set', 'door_frame_ea'],
  '08|SF': ['aluminum_storefront_sf', 'alum_window_sf'],
  // 09 Finishes
  '09|EA': ['metal_stud_ea'],
  '09|LF': ['wall_base_lf', 'track_lf'],
  '09|SY': ['carpet_tile_sy'],
  '09|SF': ['drywall_sf', 'finish_sf', 'acoustic_ceiling_sf', 'vct_sf', 'lvt_sf', 'ceramic_tile_sf', 'tile_setting_sf', 'wallcovering_sf', 'paint_sf', 'flooring_sf'],
  // 10 Specialties
  '10|EA': ['toilet_partition_ea', 'toilet_accessory_ea'],
  // 21 Fire Suppression
  '21|EA': ['sprinkler_head_ea'],
  '21|SF': ['fire_sprinkler_sf'],
  // 22 Plumbing
  '22|EA': ['plumbing_rough_ea', 'plumbing_fixture_ea'],
  // 23 HVAC
  '23|SF': ['hvac_sf'],
  // 26 Electrical
  '26|EA': ['device_ea', 'light_fixture_ea'],
  '26|SF': ['electrical_sf'],
  // 27 Communications
  '27|EA': ['data_drop_ea'],
  // 31 Earthwork
  '31|CY': ['agg_base_cy', 'excavation_cy'],
  '31|EA': ['pier_drill_ea'],
  // 32 Exterior Improvements
  '32|CY': ['concrete_cy'],
  '32|LF': ['curb_gutter_lf'],
  '32|SF': ['asphalt_paving_sf', 'wwm_sf', 'formwork_sf'],
};

/** Keyword sets for disambiguating multi-candidate buckets (lowercase substrings). */
const KEYWORDS: Record<string, string[]> = {
  // 03 / 32 SF
  formwork_sf: ['form', 'formwork', 'edge form', 'form & finish'],
  wwm_sf: ['mesh', 'wwm', 'wwf', 'welded wire', 'wire mesh'],
  conc_seal_sf: ['seal', 'polish', 'densif', 'harden', 'burnish'],
  asphalt_paving_sf: ['asphalt', 'paving', 'ac paving', 'hot mix', 'hma', 'pavement', 'blacktop'],
  // 04 EA
  cmu_wall_ea: ['cmu', 'block', 'masonry unit', 'concrete masonry'],
  masonry_tie_ea: ['tie', 'veneer tie', 'wall tie', 'brick tie'],
  // 05 EA
  steel_column_ea: ['column', 'w8', 'w-shape', 'wshape', 'post', 'hss column', 'base plate', 'w-column'],
  anchor_bolt_set: ['anchor bolt', 'anchor', 'bolt'],
  metal_stud_ea: ['stud', 'metal stud', 'framing member'],
  // 05 LF
  bar_joist_lf: ['joist', 'bar joist', 'k-series', 'open web', 'open-web'],
  track_lf: ['track', 'runner', 'furring', 'suspension', 'top track', 'bottom track'],
  // 05 SF
  metal_deck_sf: ['composite deck', 'composite', 'floor deck', 'composite floor'],
  roof_deck_sf: ['roof deck', 'roof', 'b deck', 'b-deck', 'roof metal deck'],
  // 06 SF
  sheathing_sf: ['gyp sheath', 'densglass', 'densglas', 'exterior gyp', 'sheathing', 'gypsum sheath'],
  osb_sheathing_sf: ['osb', 'oriented strand', 'wood sheath', 'plywood', 'cdx'],
  // 07 SF
  tpo_sf: ['tpo', 'single-ply', 'single ply', '60-mil', '60 mil', 'thermoplastic', 'membrane roof'],
  mod_bit_sf: ['mod-bit', 'mod bit', 'modified bitumen', 'built-up', 'built up', 'bur', '2-ply', 'sbs'],
  rigid_insul_sf: ['rigid', 'polyiso', 'poly-iso', 'iso board', 'board insul', 'xps', 'eps'],
  spray_foam_sf: ['spray foam', 'spray', 'spf', 'closed-cell', 'closed cell', 'open-cell'],
  batt_r19_sf: ['r-19', 'r19', 'r-21', 'r21', 'r-30', 'r30'],
  insulation_sf: ['r-13', 'r13', 'r-11', 'r11', 'batt'],
  vapor_barrier_sf: ['vapor', '10-mil', '10 mil', 'under-slab', 'under slab', 'visqueen', 'poly under'],
  wrb_sf: ['wrb', 'weather-resistive', 'weather resistive', 'building wrap', 'house wrap', 'air barrier', 'moisture barrier', 'tyvek'],
  waterproofing_sf: ['waterproof', 'below-grade', 'below grade', 'dampproof', 'damp proof', 'bentonite'],
  // 08 EA
  door_frame_ea: ['hollow metal', 'hm door', 'hm frame', 'steel door', 'steel frame', 'frame'],
  door_hardware_set: ['hardware', 'lockset', 'hinge', 'closer', 'exit device', 'panic'],
  wood_door_ea: ['wood door', 'solid-core', 'solid core', 'flush wood', 'sc wood'],
  // 08 SF
  aluminum_storefront_sf: ['storefront', 'store front', 'curtain wall', 'curtainwall'],
  alum_window_sf: ['window', 'punched', 'punched window', 'vision glass', 'glazing'],
  // 09 LF
  wall_base_lf: ['base', 'wall base', 'rubber base', 'cove base', 'vinyl base'],
  // 09 SF
  drywall_sf: ['drywall', 'gypsum board', 'gwb', 'gyp board', 'wallboard', 'type-x', 'type x', '5/8', 'sheetrock'],
  finish_sf: ['tape', 'mud', 'level 4', 'level 5', 'l4', 'l5', 'joint finish', 'skim'],
  acoustic_ceiling_sf: ['acoustic', 'act', 'ceiling tile', 'lay-in', 'lay in', 'suspended ceiling', 'grid ceiling'],
  vct_sf: ['vct', 'vinyl composition'],
  lvt_sf: ['lvt', 'lvp', 'luxury vinyl', 'vinyl plank'],
  ceramic_tile_sf: ['ceramic', 'porcelain', 'quarry tile', 'wall tile', 'floor tile'],
  tile_setting_sf: ['thinset', 'thin-set', 'grout', 'setting bed', 'mortar bed', 'tile setting'],
  wallcovering_sf: ['wall covering', 'wallcovering', 'wallpaper', 'vinyl wall', 'type-ii vinyl', 'fabric wrap'],
  paint_sf: ['paint', 'coating', 'primer', 'epoxy coat', '2 coats'],
  flooring_sf: ['resilient', 'sheet vinyl', 'rubber floor', 'floor finish'],
  // 10 EA
  toilet_partition_ea: ['partition', 'stall', 'toilet partition', 'urinal screen'],
  toilet_accessory_ea: ['accessor', 'grab bar', 'dispenser', 'mirror', 'napkin'],
  // 22 EA
  plumbing_fixture_ea: ['fixture', 'water closet', 'lavatory', 'lav', 'sink', 'urinal', 'drinking fountain'],
  plumbing_rough_ea: ['rough', 'rough-in', 'rough in', 'dwv', 'carrier'],
  // 26 EA
  light_fixture_ea: ['light', 'luminaire', 'lamp', 'downlight', 'lay-in light'],
  device_ea: ['device', 'receptacle', 'switch', 'outlet', 'gfci', 'wall plate'],
  // 31 CY
  excavation_cy: ['excav', 'cut', 'dig', 'earthwork', 'over-ex', 'strip'],
  agg_base_cy: ['aggregate', 'base course', 'abc', 'crushed', 'gravel', 'road base', 'sub-base', 'subbase'],
};

/**
 * Resolve a costKey for an AI takeoff line, or null when it can't be mapped with
 * confidence. `csiCode` may be any format ('03 30 00', '033000', '03'); `unit` is the
 * line's unit; `text` is the line name + description used to disambiguate.
 */
export function costKeyForCsiLine(csiCode: string, unit: string, text: string): string | null {
  const div = (csiCode || '').replace(/\D/g, '').slice(0, 2);
  const u = normalizeUnit(unit);
  if (!div || !u) return null;
  const candidates = CANDIDATES[`${div}|${u}`];
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const hay = (text || '').toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const key of candidates) {
    const kws = KEYWORDS[key];
    if (!kws) continue;
    let score = 0;
    for (const kw of kws) if (hay.includes(kw)) score++;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return bestScore > 0 ? best : null;
}
