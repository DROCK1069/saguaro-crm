/**
 * Assembly library + explosion — the "smart core". One measured condition
 * explodes into its full, formula-derived, priced bill of materials + labor.
 * Deterministic: same condition + same assembly → identical line items.
 *
 * v2: real commercial coverage (~45 assemblies), opening deductions, an accurate
 * stud-count formula, and cost-bucket routing (material/labor/equipment/sub).
 * All v2 behavior is gated behind new optional fields → v1 output is preserved
 * whenever those fields are absent (see explodeCondition order-of-operations).
 */
import type { Assembly, AssemblyComponent, Condition, LineItem, RateOverrides } from './types';
import { unitCostCents, rateSourceFor } from './cost';
import { round2 } from './geometry';

const C = (c: Partial<AssemblyComponent> & { key: string; name: string; csi: string; trade: string; unit: string; per: number; costKey: string }): AssemblyComponent => ({ ...c });

/**
 * Default BARE crew wage (cents/hr) by trade — retires the single blended $65 so steel is no
 * longer priced like drywall. Payroll burden (WC/FICA/fringe) is applied ONCE at rollup via
 * laborBurdenPct, so these are bare wages. A tenant/opts rate wins; regionMultiplier scales these.
 */
export const DEFAULT_CREW_RATES_CENTS: Record<string, number> = {
  'Structural Steel': 8500, Metals: 8500, 'Deep Foundations': 9000,
  Concrete: 7500, 'Site Concrete': 7200, Earthwork: 7000, Masonry: 7200,
  Framing: 6800, 'Rough Carpentry': 6800, Millwork: 6800,
  Drywall: 6200, Insulation: 6000, 'Thermal & Moisture': 6500, Moisture: 6500, Roofing: 7000,
  Openings: 7200, Glazing: 7500, Finishes: 6000, Flooring: 6000, Painting: 5800, Tile: 6400, Ceilings: 6300,
  Specialties: 6500, Electrical: 8800, 'Low Voltage': 7500, Plumbing: 8500, Mechanical: 9000, HVAC: 9000,
  'Fire Protection': 8000, Sitework: 7000,
};

// Catalog stud/track stick length (ft): metal_stud_ea and track rates are priced for a 9 ft wall.
// A taller wall uses proportionally taller/heavier studs, so stud material+labor must scale by
// height above this — otherwise a 24 ft demising wall gets framed at a 9 ft price (systematic under-bid).
const STUD_STOCK_FT = 9;

/**
 * Crew wage (cents/hr) for a component. Precedence: explicit tenant rate (by trade OR 2-digit
 * CSI division, region-agnostic) → per-trade default × regionMultiplier → blended fallback × region.
 */
export function crewRateForTrade(
  trade: string,
  csi: string,
  o?: { crewRatesCents?: Record<string, number>; crewRateCents?: number; regionMultiplier?: number },
): number {
  const over = o?.crewRatesCents;
  const div = (csi || '').slice(0, 2);
  const tenant = over ? (over[trade] ?? over[div]) : undefined;
  if (tenant != null) return tenant;
  const m = o?.regionMultiplier && o.regionMultiplier > 0 ? o.regionMultiplier : 1;
  const base = DEFAULT_CREW_RATES_CENTS[trade] ?? o?.crewRateCents ?? 6500;
  return m === 1 ? base : Math.round(base * m);
}

export const ASSEMBLIES: Record<string, Assembly> = {
  interior_partition: {
    id: 'interior_partition', name: 'Interior partition (metal stud + GWB)', appliesTo: 'linear',
    components: [
      C({ key: 'drywall', name: '5/8" Type-X drywall', csi: '09 29 00', trade: 'Drywall', unit: 'SF', per: 1, useHeight: true, bothSides: true, netOpenings: true, wastePct: 10, costKey: 'drywall_sf', laborHrsPerUnit: 0.008 }),
      C({ key: 'studs', name: '3-5/8" metal studs @ 16" OC', csi: '09 22 16', trade: 'Framing', unit: 'EA', per: 1, qtyFormula: 'studCount', spacingIn: 16, endStuds: 1, openingStudAdder: 3, framingAllowancePct: 10, round: 'ceil', wastePct: 3, costKey: 'metal_stud_ea', laborHrsPerUnit: 0.05 }),
      C({ key: 'track', name: 'Top & bottom track', csi: '09 22 16', trade: 'Framing', unit: 'LF', per: 2, wastePct: 5, costKey: 'track_lf', laborHrsPerUnit: 0.01 }),
      C({ key: 'insul', name: 'R-13 batt insulation', csi: '07 21 00', trade: 'Insulation', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 8, costKey: 'insulation_sf', laborHrsPerUnit: 0.004 }),
      C({ key: 'finish', name: 'Tape, mud & finish L4', csi: '09 29 00', trade: 'Drywall', unit: 'SF', per: 1, useHeight: true, bothSides: true, netOpenings: true, wastePct: 5, costKey: 'finish_sf', laborHrsPerUnit: 0.006 }),
    ],
  },
  /**
   * CORRECTNESS FIX (v3): the default slab is now genuinely reinforced. The old 0.15 lb/SF
   * was ~6× light (basically unreinforced) and quietly under-priced every slab that used it.
   * Default = #4 @ 18" o.c. one-way + temperature steel ≈ 0.45 lb/SF (defensible light-commercial
   * SOG). Use `slab_on_grade_heavy` (0.89, #4 EW) for structural/rack-loaded slabs, or
   * `slab_on_grade_fibermesh` for an explicitly unreinforced fiber-mesh slab.
   */
  slab_on_grade: {
    id: 'slab_on_grade', name: 'Slab-on-grade (reinf #4@18" + temp)', appliesTo: 'area',
    components: [
      C({ key: 'concrete', name: 'Concrete 3000psi', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.9 }),
      C({ key: 'rebar', name: '#4 rebar @ 18" OC + temp', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 0.45, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.005 }),
      C({ key: 'vapor', name: 'Vapor barrier 10-mil', csi: '07 26 00', trade: 'Moisture', unit: 'SF', per: 1, wastePct: 10, costKey: 'vapor_barrier_sf', laborHrsPerUnit: 0.001 }),
    ],
  },
  /** Explicitly UNREINFORCED slab — fiber-mesh admixture, no rebar. Pick this only when the
   *  drawings actually call for a non-structural fiber slab (the old 0.15 lb/SF masqueraded as this). */
  slab_on_grade_fibermesh: {
    id: 'slab_on_grade_fibermesh', name: 'Slab-on-grade (fiber-mesh, unreinforced)', appliesTo: 'area',
    components: [
      C({ key: 'concrete', name: 'Concrete 3000psi w/ fiber mesh', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.85 }),
      C({ key: 'vapor', name: 'Vapor barrier 10-mil', csi: '07 26 00', trade: 'Moisture', unit: 'SF', per: 1, wastePct: 10, costKey: 'vapor_barrier_sf', laborHrsPerUnit: 0.001 }),
    ],
  },
  /**
   * Structural / rack-loaded slab: real #4 @ 18" o.c. each way = 2 × (1/1.5) × 0.668 = 0.89 lb/SF.
   */
  slab_on_grade_heavy: {
    id: 'slab_on_grade_heavy', name: 'Slab-on-grade (heavy reinf #4@18" EW)', appliesTo: 'area',
    components: [
      C({ key: 'concrete', name: 'Concrete 3000psi', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.9 }),
      C({ key: 'rebar', name: '#4 rebar @ 18" OC EW', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 0.89, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.006 }),
      C({ key: 'vapor', name: 'Vapor barrier 10-mil', csi: '07 26 00', trade: 'Moisture', unit: 'SF', per: 1, wastePct: 10, costKey: 'vapor_barrier_sf', laborHrsPerUnit: 0.001 }),
    ],
  },
  cont_footing: {
    id: 'cont_footing', name: 'Continuous footing (2×1)', appliesTo: 'linear',
    components: [
      C({ key: 'concrete', name: 'Footing concrete', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 2 / 27, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.5 }),
      C({ key: 'rebar', name: '(3) #5 continuous', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 3.13, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.02 }),
      C({ key: 'form', name: 'Edge formwork', csi: '03 11 00', trade: 'Concrete', unit: 'SF', per: 2, wastePct: 10, costKey: 'formwork_sf', laborHrsPerUnit: 0.03 }),
    ],
  },
  steel_column: {
    id: 'steel_column', name: 'Steel column (W8×24)', appliesTo: 'count',
    components: [
      C({ key: 'col', name: 'W8×24 column + base plate', csi: '05 12 00', trade: 'Structural Steel', unit: 'EA', per: 1, costKey: 'steel_column_ea', laborHrsPerUnit: 2 }),
      C({ key: 'anchors', name: 'Anchor bolt set (4)', csi: '05 12 00', trade: 'Structural Steel', unit: 'EA', per: 1, costKey: 'anchor_bolt_set', laborHrsPerUnit: 0.5 }),
    ],
  },
  door_frame: {
    id: 'door_frame', name: 'Door, frame & hardware', appliesTo: 'count',
    components: [
      C({ key: 'door', name: 'HM door + frame', csi: '08 11 00', trade: 'Openings', unit: 'EA', per: 1, costKey: 'door_frame_ea', laborHrsPerUnit: 2.5 }),
      C({ key: 'hw', name: 'Hardware set', csi: '08 71 00', trade: 'Openings', unit: 'EA', per: 1, costKey: 'door_hardware_set', laborHrsPerUnit: 1 }),
    ],
  },
  roof_tpo: {
    id: 'roof_tpo', name: 'TPO membrane roof', appliesTo: 'area',
    components: [
      C({ key: 'tpo', name: 'TPO 60-mil membrane', csi: '07 54 00', trade: 'Roofing', unit: 'SF', per: 1, wastePct: 10, costKey: 'tpo_sf', laborHrsPerUnit: 0.01 }),
      C({ key: 'insul', name: 'Rigid insulation', csi: '07 22 00', trade: 'Roofing', unit: 'SF', per: 1, wastePct: 8, costKey: 'rigid_insul_sf', laborHrsPerUnit: 0.006 }),
    ],
  },
  cmu_wall: {
    id: 'cmu_wall', name: 'CMU wall (8")', appliesTo: 'area',
    components: [
      C({ key: 'cmu', name: '8" CMU block', csi: '04 22 00', trade: 'Masonry', unit: 'EA', per: 1.125, round: 'ceil', wastePct: 5, costKey: 'cmu_wall_ea', laborHrsPerUnit: 0.1 }),
      C({ key: 'grout', name: 'Grout (solid cells)', csi: '04 05 16', trade: 'Masonry', unit: 'CY', per: 0.012, wastePct: 8, costKey: 'grout_cy', laborHrsPerUnit: 0.02 }),
      C({ key: 'rebar', name: 'Vertical reinforcing', csi: '04 05 19', trade: 'Masonry', unit: 'LB', per: 0.9, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.006 }),
    ],
  },
  struct_steel_beam: {
    id: 'struct_steel_beam', name: 'Structural steel beam', appliesTo: 'linear',
    components: [
      C({ key: 'beam', name: 'W-shape beam (erected)', csi: '05 12 00', trade: 'Structural Steel', unit: 'LB', per: 26, wastePct: 3, costKey: 'steel_beam_lb', laborHrsPerUnit: 0.06 }),
    ],
  },
  acoustic_ceiling: {
    id: 'acoustic_ceiling', name: 'Acoustic ceiling (ACT)', appliesTo: 'area',
    components: [
      C({ key: 'act', name: 'ACT grid + tile', csi: '09 51 00', trade: 'Ceilings', unit: 'SF', per: 1, wastePct: 8, costKey: 'acoustic_ceiling_sf', laborHrsPerUnit: 0.015 }),
    ],
  },
  flooring: {
    id: 'flooring', name: 'Resilient flooring', appliesTo: 'area',
    components: [
      C({ key: 'floor', name: 'VCT / LVT flooring', csi: '09 65 00', trade: 'Flooring', unit: 'SF', per: 1, wastePct: 10, costKey: 'flooring_sf', laborHrsPerUnit: 0.012 }),
    ],
  },
  paint_walls: {
    id: 'paint_walls', name: 'Paint (walls)', appliesTo: 'area',
    components: [
      C({ key: 'paint', name: 'Paint — 2 coats', csi: '09 91 00', trade: 'Painting', unit: 'SF', per: 1, wastePct: 5, costKey: 'paint_sf', laborHrsPerUnit: 0.006 }),
    ],
  },
  plumbing_fixtures: {
    id: 'plumbing_fixtures', name: 'Plumbing fixtures', appliesTo: 'count',
    components: [
      C({ key: 'fix', name: 'Fixture (rough + set)', csi: '22 40 00', trade: 'Plumbing', unit: 'EA', per: 1, costKey: 'plumbing_fixture_ea', laborHrsPerUnit: 6 }),
    ],
  },
  light_fixtures: {
    id: 'light_fixtures', name: 'Light fixtures', appliesTo: 'count',
    components: [
      C({ key: 'lt', name: 'Light fixture (furnish + install)', csi: '26 51 00', trade: 'Electrical', unit: 'EA', per: 1, costKey: 'light_fixture_ea', laborHrsPerUnit: 1.5 }),
    ],
  },

  // ================= v2 ADDITIONS =================

  // ---- Div 31/32 — Sitework ----
  mass_excavation: {
    id: 'mass_excavation', name: 'Mass excavation (cut)', appliesTo: 'area',
    components: [
      C({ key: 'cut', name: 'Bulk excavation', csi: '31 23 16', trade: 'Earthwork', unit: 'CY', per: 1 / 27, useThickness: true, costType: 'equipment', wastePct: 15, costKey: 'excavation_cy', laborHrsPerUnit: 0.03 }),
    ],
  },
  aggregate_base: {
    id: 'aggregate_base', name: 'Aggregate base course', appliesTo: 'area',
    components: [
      C({ key: 'base', name: 'Crushed aggregate base', csi: '31 23 23', trade: 'Earthwork', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 10, costKey: 'agg_base_cy', laborHrsPerUnit: 0.15 }),
    ],
  },
  asphalt_paving: {
    id: 'asphalt_paving', name: 'Asphalt paving', appliesTo: 'area',
    components: [
      C({ key: 'ac', name: 'Asphaltic concrete (SUB)', csi: '32 12 16', trade: 'Paving', unit: 'SF', per: 1, costType: 'sub', wastePct: 0, costKey: 'asphalt_paving_sf', laborHrsPerUnit: 0 }),
    ],
  },
  concrete_sidewalk: {
    id: 'concrete_sidewalk', name: 'Concrete sidewalk / flatwork', appliesTo: 'area',
    components: [
      C({ key: 'conc', name: 'Sidewalk concrete', csi: '32 13 13', trade: 'Site Concrete', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.9 }),
      C({ key: 'mesh', name: 'Welded wire mesh', csi: '32 13 13', trade: 'Site Concrete', unit: 'SF', per: 1, wastePct: 10, costKey: 'wwm_sf', laborHrsPerUnit: 0.003 }),
      C({ key: 'form', name: 'Form & finish', csi: '32 13 13', trade: 'Site Concrete', unit: 'SF', per: 0.2, wastePct: 10, costKey: 'formwork_sf', laborHrsPerUnit: 0.02 }),
    ],
  },
  curb_gutter: {
    id: 'curb_gutter', name: 'Curb & gutter', appliesTo: 'linear',
    components: [
      C({ key: 'curb', name: '6" CIP curb & gutter', csi: '32 16 13', trade: 'Site Concrete', unit: 'LF', per: 1, wastePct: 8, costKey: 'curb_gutter_lf', laborHrsPerUnit: 0.15 }),
    ],
  },

  // ---- Div 03 — Concrete ----
  elevated_slab: {
    id: 'elevated_slab', name: 'Elevated slab (composite deck)', appliesTo: 'area',
    components: [
      C({ key: 'deck', name: 'Composite metal deck', csi: '05 31 00', trade: 'Metals', unit: 'SF', per: 1, wastePct: 5, costKey: 'metal_deck_sf', laborHrsPerUnit: 0.02 }),
      C({ key: 'conc', name: 'Concrete topping', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.9 }),
      C({ key: 'mesh', name: 'Welded wire mesh', csi: '03 21 00', trade: 'Concrete', unit: 'SF', per: 1, wastePct: 10, costKey: 'wwm_sf', laborHrsPerUnit: 0.004 }),
    ],
  },
  concrete_wall: {
    id: 'concrete_wall', name: 'Cast-in-place concrete wall', appliesTo: 'area',
    components: [
      C({ key: 'conc', name: 'Wall concrete', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 1 / 27, useThickness: true, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 1.2 }),
      C({ key: 'forms', name: 'Wall formwork (both faces)', csi: '03 11 00', trade: 'Concrete', unit: 'SF', per: 1, bothSides: true, wastePct: 10, costKey: 'formwork_sf', laborHrsPerUnit: 0.08 }),
      C({ key: 'rebar', name: 'Wall reinforcing', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 3.5, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.012 }),
    ],
  },
  grade_beam: {
    id: 'grade_beam', name: 'Grade beam', appliesTo: 'linear',
    components: [
      C({ key: 'conc', name: 'Grade beam concrete', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 3 / 27, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.8 }),
      C({ key: 'rebar', name: 'Grade beam reinforcing', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 6.3, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.02 }),
      C({ key: 'forms', name: 'Grade beam formwork', csi: '03 11 00', trade: 'Concrete', unit: 'SF', per: 3, wastePct: 10, costKey: 'formwork_sf', laborHrsPerUnit: 0.05 }),
    ],
  },
  drilled_pier: {
    id: 'drilled_pier', name: 'Drilled pier / caisson', appliesTo: 'count',
    components: [
      C({ key: 'conc', name: 'Pier concrete', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 0.44, wastePct: 8, costKey: 'concrete_cy', laborHrsPerUnit: 1.5 }),
      C({ key: 'cage', name: 'Rebar cage', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 60, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.6 }),
      C({ key: 'drill', name: 'Drill pier (rig)', csi: '31 63 29', trade: 'Deep Foundations', unit: 'EA', per: 1, round: 'ceil', costType: 'equipment', wastePct: 0, costKey: 'pier_drill_ea', laborHrsPerUnit: 0 }),
    ],
  },
  spread_footing: {
    id: 'spread_footing', name: 'Spread footing', appliesTo: 'count',
    components: [
      C({ key: 'conc', name: 'Footing concrete', csi: '03 30 00', trade: 'Concrete', unit: 'CY', per: 0.9, wastePct: 5, costKey: 'concrete_cy', laborHrsPerUnit: 0.6 }),
      C({ key: 'rebar', name: 'Footing reinforcing', csi: '03 21 00', trade: 'Concrete', unit: 'LB', per: 24, wastePct: 5, costKey: 'rebar_lb', laborHrsPerUnit: 0.3 }),
      C({ key: 'forms', name: 'Footing formwork', csi: '03 11 00', trade: 'Concrete', unit: 'SF', per: 12, wastePct: 10, costKey: 'formwork_sf', laborHrsPerUnit: 0.04 }),
    ],
  },

  // ---- Div 04 — Masonry ----
  brick_veneer: {
    id: 'brick_veneer', name: 'Brick veneer', appliesTo: 'area',
    components: [
      C({ key: 'brick', name: 'Modular brick + mortar', csi: '04 21 13', trade: 'Masonry', unit: 'SF', per: 1, netOpenings: true, wastePct: 5, costKey: 'brick_veneer_sf', laborHrsPerUnit: 0.09 }),
      C({ key: 'ties', name: 'Masonry ties', csi: '04 05 23', trade: 'Masonry', unit: 'EA', per: 0.1, round: 'ceil', wastePct: 5, costKey: 'masonry_tie_ea', laborHrsPerUnit: 0.01 }),
      C({ key: 'wrb', name: 'Air/moisture barrier', csi: '07 27 00', trade: 'Thermal & Moisture', unit: 'SF', per: 1, netOpenings: true, wastePct: 10, costKey: 'wrb_sf', laborHrsPerUnit: 0.004 }),
    ],
  },

  // ---- Div 05 — Structural Steel ----
  bar_joist: {
    id: 'bar_joist', name: 'Open-web bar joist', appliesTo: 'linear',
    components: [
      C({ key: 'joist', name: 'K-series bar joist', csi: '05 21 00', trade: 'Structural Steel', unit: 'LF', per: 1, wastePct: 3, costKey: 'bar_joist_lf', laborHrsPerUnit: 0.08 }),
    ],
  },
  roof_deck: {
    id: 'roof_deck', name: 'Steel roof deck', appliesTo: 'area',
    components: [
      C({ key: 'deck', name: '1.5" B roof deck', csi: '05 31 00', trade: 'Structural Steel', unit: 'SF', per: 1, wastePct: 5, costKey: 'roof_deck_sf', laborHrsPerUnit: 0.02 }),
    ],
  },

  // ---- Div 06 / 09 22 — Framing ----
  exterior_stud_wall: {
    id: 'exterior_stud_wall', name: 'Exterior metal stud wall (full assembly)', appliesTo: 'linear',
    components: [
      C({ key: 'studs', name: '6" metal studs @ 16" OC', csi: '05 41 00', trade: 'Framing', unit: 'EA', per: 1, qtyFormula: 'studCount', spacingIn: 16, endStuds: 1, openingStudAdder: 4, framingAllowancePct: 12, round: 'ceil', wastePct: 3, costKey: 'metal_stud_ea', laborHrsPerUnit: 0.05 }),
      C({ key: 'track', name: 'Top & bottom track', csi: '05 41 00', trade: 'Framing', unit: 'LF', per: 2, wastePct: 5, costKey: 'track_lf', laborHrsPerUnit: 0.012 }),
      C({ key: 'sheathing', name: 'Exterior gyp sheathing', csi: '06 16 00', trade: 'Framing', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 10, costKey: 'sheathing_sf', laborHrsPerUnit: 0.012 }),
      C({ key: 'wrb', name: 'Weather-resistive barrier', csi: '07 25 00', trade: 'Thermal & Moisture', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 12, costKey: 'wrb_sf', laborHrsPerUnit: 0.004 }),
      C({ key: 'batt', name: 'R-19 batt insulation', csi: '07 21 00', trade: 'Insulation', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 8, costKey: 'batt_r19_sf', laborHrsPerUnit: 0.004 }),
      C({ key: 'gwb', name: 'Interior GWB (inside face)', csi: '09 29 00', trade: 'Drywall', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 10, costKey: 'drywall_sf', laborHrsPerUnit: 0.008 }),
      C({ key: 'finish', name: 'Tape, mud & finish L4', csi: '09 29 00', trade: 'Drywall', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 5, costKey: 'finish_sf', laborHrsPerUnit: 0.006 }),
    ],
  },
  wood_stud_wall: {
    id: 'wood_stud_wall', name: 'Wood stud wall', appliesTo: 'linear',
    components: [
      C({ key: 'studs', name: '2x6 studs @ 16" OC', csi: '06 11 00', trade: 'Rough Carpentry', unit: 'EA', per: 1, qtyFormula: 'studCount', spacingIn: 16, endStuds: 1, openingStudAdder: 4, framingAllowancePct: 12, round: 'ceil', wastePct: 5, costKey: 'wood_stud_ea', laborHrsPerUnit: 0.04 }),
      C({ key: 'plates', name: 'Double top + bottom plate', csi: '06 11 00', trade: 'Rough Carpentry', unit: 'LF', per: 3, wastePct: 8, costKey: 'wood_plate_lf', laborHrsPerUnit: 0.015 }),
      C({ key: 'sheathing', name: 'OSB sheathing', csi: '06 16 00', trade: 'Rough Carpentry', unit: 'SF', per: 1, useHeight: true, netOpenings: true, wastePct: 10, costKey: 'osb_sheathing_sf', laborHrsPerUnit: 0.012 }),
    ],
  },

  // ---- Div 07 — Thermal / Moisture ----
  batt_insulation: {
    id: 'batt_insulation', name: 'Batt insulation', appliesTo: 'area',
    components: [
      C({ key: 'batt', name: 'R-19 batt', csi: '07 21 00', trade: 'Insulation', unit: 'SF', per: 1, netOpenings: true, wastePct: 8, costKey: 'batt_r19_sf', laborHrsPerUnit: 0.004 }),
    ],
  },
  rigid_insulation: {
    id: 'rigid_insulation', name: 'Rigid insulation', appliesTo: 'area',
    components: [
      C({ key: 'rigid', name: 'Rigid board insulation', csi: '07 21 00', trade: 'Insulation', unit: 'SF', per: 1, netOpenings: true, wastePct: 8, costKey: 'rigid_insul_sf', laborHrsPerUnit: 0.006 }),
    ],
  },
  spray_foam: {
    id: 'spray_foam', name: 'Spray foam insulation', appliesTo: 'area',
    components: [
      C({ key: 'spf', name: '2" closed-cell SPF', csi: '07 21 19', trade: 'Insulation', unit: 'SF', per: 1, netOpenings: true, wastePct: 5, costKey: 'spray_foam_sf', laborHrsPerUnit: 0.01 }),
    ],
  },
  roof_modbit: {
    id: 'roof_modbit', name: 'Modified bitumen roof', appliesTo: 'area',
    components: [
      C({ key: 'modbit', name: '2-ply mod-bit membrane', csi: '07 52 00', trade: 'Roofing', unit: 'SF', per: 1, wastePct: 10, costKey: 'mod_bit_sf', laborHrsPerUnit: 0.015 }),
      C({ key: 'insul', name: 'Rigid roof insulation', csi: '07 22 00', trade: 'Roofing', unit: 'SF', per: 1, wastePct: 8, costKey: 'rigid_insul_sf', laborHrsPerUnit: 0.006 }),
    ],
  },
  waterproofing: {
    id: 'waterproofing', name: 'Below-grade waterproofing', appliesTo: 'area',
    components: [
      C({ key: 'wp', name: 'Waterproofing membrane', csi: '07 13 00', trade: 'Thermal & Moisture', unit: 'SF', per: 1, wastePct: 10, costKey: 'waterproofing_sf', laborHrsPerUnit: 0.02 }),
    ],
  },
  sealants: {
    id: 'sealants', name: 'Joint sealants', appliesTo: 'linear',
    components: [
      C({ key: 'caulk', name: 'Exterior urethane sealant', csi: '07 92 00', trade: 'Thermal & Moisture', unit: 'LF', per: 1, wastePct: 5, costKey: 'sealant_lf', laborHrsPerUnit: 0.02 }),
    ],
  },

  // ---- Div 08 — Openings ----
  wood_door: {
    id: 'wood_door', name: 'Wood door, frame & hardware', appliesTo: 'count',
    components: [
      C({ key: 'door', name: 'Solid-core wood door + frame', csi: '08 14 00', trade: 'Openings', unit: 'EA', per: 1, round: 'ceil', costKey: 'wood_door_ea', laborHrsPerUnit: 2 }),
      C({ key: 'hw', name: 'Hardware set', csi: '08 71 00', trade: 'Openings', unit: 'EA', per: 1, round: 'ceil', costKey: 'door_hardware_set', laborHrsPerUnit: 1 }),
    ],
  },
  aluminum_storefront: {
    id: 'aluminum_storefront', name: 'Aluminum storefront', appliesTo: 'area',
    components: [
      C({ key: 'sf', name: 'Storefront system + glazing (SUB)', csi: '08 43 00', trade: 'Openings', unit: 'SF', per: 1, costType: 'sub', wastePct: 0, costKey: 'aluminum_storefront_sf', laborHrsPerUnit: 0 }),
    ],
  },
  window: {
    id: 'window', name: 'Commercial window', appliesTo: 'area',
    components: [
      C({ key: 'win', name: 'Aluminum punched window', csi: '08 51 13', trade: 'Openings', unit: 'SF', per: 1, wastePct: 5, costKey: 'alum_window_sf', laborHrsPerUnit: 0.08 }),
    ],
  },

  // ---- Div 09 — Finishes ----
  gypsum_ceiling: {
    id: 'gypsum_ceiling', name: 'Gypsum board ceiling', appliesTo: 'area',
    components: [
      C({ key: 'board', name: '5/8" GWB ceiling', csi: '09 29 00', trade: 'Drywall', unit: 'SF', per: 1, wastePct: 10, costKey: 'drywall_sf', laborHrsPerUnit: 0.012 }),
      C({ key: 'framing', name: 'Suspension / furring', csi: '09 22 16', trade: 'Framing', unit: 'LF', per: 0.3, wastePct: 5, costKey: 'track_lf', laborHrsPerUnit: 0.02 }),
      C({ key: 'finish', name: 'Tape, mud & finish', csi: '09 29 00', trade: 'Drywall', unit: 'SF', per: 1, wastePct: 5, costKey: 'finish_sf', laborHrsPerUnit: 0.008 }),
    ],
  },
  flooring_vct: {
    id: 'flooring_vct', name: 'VCT flooring', appliesTo: 'area',
    components: [
      C({ key: 'vct', name: 'Vinyl composition tile', csi: '09 65 19', trade: 'Flooring', unit: 'SF', per: 1, wastePct: 10, costKey: 'vct_sf', laborHrsPerUnit: 0.012 }),
    ],
  },
  flooring_lvt: {
    id: 'flooring_lvt', name: 'LVT flooring', appliesTo: 'area',
    components: [
      C({ key: 'lvt', name: 'Luxury vinyl tile/plank', csi: '09 65 19', trade: 'Flooring', unit: 'SF', per: 1, wastePct: 8, costKey: 'lvt_sf', laborHrsPerUnit: 0.015 }),
    ],
  },
  flooring_carpet: {
    id: 'flooring_carpet', name: 'Carpet tile', appliesTo: 'area',
    components: [
      C({ key: 'carpet', name: 'Carpet tile', csi: '09 68 13', trade: 'Flooring', unit: 'SY', per: 1 / 9, wastePct: 10, costKey: 'carpet_tile_sy', laborHrsPerUnit: 0.09 }),
    ],
  },
  flooring_tile: {
    id: 'flooring_tile', name: 'Ceramic/porcelain tile', appliesTo: 'area',
    components: [
      C({ key: 'tile', name: 'Ceramic tile', csi: '09 30 00', trade: 'Flooring', unit: 'SF', per: 1, wastePct: 12, costKey: 'ceramic_tile_sf', laborHrsPerUnit: 0.06 }),
      C({ key: 'set', name: 'Thinset & grout', csi: '09 30 00', trade: 'Flooring', unit: 'SF', per: 1, wastePct: 10, costKey: 'tile_setting_sf', laborHrsPerUnit: 0.01 }),
    ],
  },
  sealed_concrete_floor: {
    id: 'sealed_concrete_floor', name: 'Sealed/polished concrete floor', appliesTo: 'area',
    components: [
      C({ key: 'seal', name: 'Densify + seal/polish', csi: '03 35 00', trade: 'Flooring', unit: 'SF', per: 1, wastePct: 5, costKey: 'conc_seal_sf', laborHrsPerUnit: 0.008 }),
    ],
  },
  wall_base: {
    id: 'wall_base', name: 'Resilient wall base', appliesTo: 'linear',
    components: [
      C({ key: 'base', name: '4" rubber wall base', csi: '09 65 13', trade: 'Flooring', unit: 'LF', per: 1, wastePct: 8, costKey: 'wall_base_lf', laborHrsPerUnit: 0.02 }),
    ],
  },
  wall_covering: {
    id: 'wall_covering', name: 'Vinyl wall covering', appliesTo: 'area',
    components: [
      C({ key: 'vinyl', name: 'Type-II vinyl wall covering', csi: '09 72 00', trade: 'Finishes', unit: 'SF', per: 1, netOpenings: true, wastePct: 15, costKey: 'wallcovering_sf', laborHrsPerUnit: 0.02 }),
    ],
  },

  // ---- Div 10 — Specialties ----
  toilet_partitions: {
    id: 'toilet_partitions', name: 'Toilet partitions', appliesTo: 'count',
    components: [
      C({ key: 'stall', name: 'Powder-coat metal partition (per stall)', csi: '10 21 13', trade: 'Specialties', unit: 'EA', per: 1, round: 'ceil', wastePct: 0, costKey: 'toilet_partition_ea', laborHrsPerUnit: 1.5 }),
    ],
  },
  toilet_accessories: {
    id: 'toilet_accessories', name: 'Toilet accessories', appliesTo: 'count',
    components: [
      C({ key: 'acc', name: 'Accessory set (per fixture group)', csi: '10 28 00', trade: 'Specialties', unit: 'EA', per: 1, round: 'ceil', wastePct: 0, costKey: 'toilet_accessory_ea', laborHrsPerUnit: 0.4 }),
    ],
  },

  // ---- Div 21/22/23/26 — MEP parametric allowances ----
  hvac_allowance: {
    id: 'hvac_allowance', name: 'HVAC allowance ($/SF, SUB)', appliesTo: 'area',
    components: [
      C({ key: 'hvac', name: 'Light-commercial HVAC (SUB)', csi: '23 00 00', trade: 'HVAC', unit: 'SF', per: 1, costType: 'sub', wastePct: 0, costKey: 'hvac_sf', laborHrsPerUnit: 0 }),
    ],
  },
  fire_sprinkler: {
    id: 'fire_sprinkler', name: 'Fire sprinkler ($/SF, SUB)', appliesTo: 'area',
    components: [
      C({ key: 'wet', name: 'Wet sprinkler system (SUB)', csi: '21 13 00', trade: 'Fire Suppression', unit: 'SF', per: 1, costType: 'sub', wastePct: 0, costKey: 'fire_sprinkler_sf', laborHrsPerUnit: 0 }),
    ],
  },
  fire_sprinkler_heads: {
    id: 'fire_sprinkler_heads', name: 'Fire sprinkler heads (count, SUB)', appliesTo: 'count',
    components: [
      C({ key: 'head', name: 'Sprinkler head + branch (SUB)', csi: '21 13 00', trade: 'Fire Suppression', unit: 'EA', per: 1, round: 'ceil', costType: 'sub', wastePct: 0, costKey: 'sprinkler_head_ea', laborHrsPerUnit: 0 }),
    ],
  },
  plumbing_rough: {
    id: 'plumbing_rough', name: 'Plumbing rough-in (per fixture, SUB)', appliesTo: 'count',
    components: [
      C({ key: 'rough', name: 'DWV + supply rough (SUB)', csi: '22 11 00', trade: 'Plumbing', unit: 'EA', per: 1, round: 'ceil', costType: 'sub', wastePct: 0, costKey: 'plumbing_rough_ea', laborHrsPerUnit: 0 }),
    ],
  },
  electrical_allowance: {
    id: 'electrical_allowance', name: 'Electrical allowance ($/SF, SUB)', appliesTo: 'area',
    components: [
      C({ key: 'branch', name: 'Branch power + distribution (SUB)', csi: '26 00 00', trade: 'Electrical', unit: 'SF', per: 1, costType: 'sub', wastePct: 0, costKey: 'electrical_sf', laborHrsPerUnit: 0 }),
    ],
  },
  wiring_devices: {
    id: 'wiring_devices', name: 'Wiring devices', appliesTo: 'count',
    components: [
      C({ key: 'device', name: 'Receptacle/switch + plate', csi: '26 27 26', trade: 'Electrical', unit: 'EA', per: 1, round: 'ceil', wastePct: 0, costKey: 'device_ea', laborHrsPerUnit: 0.4 }),
    ],
  },
  data_drops: {
    id: 'data_drops', name: 'Data drops (Cat6, SUB)', appliesTo: 'count',
    components: [
      C({ key: 'drop', name: 'Cat6 drop + termination (SUB)', csi: '27 15 00', trade: 'Communications', unit: 'EA', per: 1, round: 'ceil', costType: 'sub', wastePct: 0, costKey: 'data_drop_ea', laborHrsPerUnit: 0 }),
    ],
  },
};

/** Assembly ids + what they measure — for the AI blueprint reader to map scope onto. */
export const ASSEMBLY_MENU = Object.values(ASSEMBLIES).map((a) => ({ id: a.id, name: a.name, kind: a.appliesTo }));

export const assemblyById = (id: string): Assembly | undefined => ASSEMBLIES[id];

/** Tiny epsilon to keep exact integer divisions (e.g. 40 LF / 16") from float-overshooting a ceil. */
const CEIL_EPS = 1e-9;

/**
 * Accurate framing count. Replaces the flat `per: 0.75` guess:
 *   fieldStuds = ceil(LF / spacingFt)              (studs along the run)
 *   runStuds   = fieldStuds + endStuds             (+ end stud)
 *   openStuds  = openingsCount × openingStudAdder   (king/jack/cripple per opening)
 *   base       = ceil((runStuds + openStuds) × (1 + framingAllowancePct/100))  (+corners/blocking)
 * `base` is pre-waste and drives labor; material qty adds waste on top.
 */
function studCountBase(cond: Condition, c: AssemblyComponent): number {
  const spacingIn = cond.studSpacingIn ?? c.spacingIn ?? 16;
  const spacingFt = spacingIn > 0 ? spacingIn / 12 : 16 / 12;
  const fieldStuds = Math.ceil(cond.value / spacingFt - CEIL_EPS);
  const runStuds = fieldStuds + (c.endStuds ?? 1);
  const openStuds = (cond.openingsCount ?? 0) * (c.openingStudAdder ?? 0);
  const allow = (c.framingAllowancePct ?? 0) / 100;
  return Math.ceil((runStuds + openStuds) * (1 + allow) - CEIL_EPS);
}

/** Per-trade crew wage + regional overlay, threaded from ComputeOpts into the explosion. */
export interface ExplodeOpts { crewRatesCents?: Record<string, number>; regionMultiplier?: number; applyWinFactors?: boolean; winFactorByDivision?: Record<string, number> }

/** THE explosion: one condition → its full priced line items (tenant rates win). */
export function explodeCondition(cond: Condition, crewRateCents: number, rates?: RateOverrides, o?: ExplodeOpts): LineItem[] {
  const asm = ASSEMBLIES[cond.assemblyId];
  if (!asm) return [];
  const instN = cond.instanceCount && cond.instanceCount > 0 ? Math.floor(cond.instanceCount) : 1;
  const region = o?.regionMultiplier;
  return asm.components.map((c) => {
    // ---- pre-waste base quantity for a SINGLE instance ----
    let base1: number;
    if (c.qtyFormula === 'studCount') {
      base1 = studCountBase(cond, c);
      // Stud COUNT is set by wall length, but a taller wall uses proportionally taller/heavier studs
      // (the catalog rate is a 9 ft stick). Scale material + erection labor by height above 9 ft so a
      // 24 ft wall isn't framed at a 9 ft price. Walls ≤9 ft are unchanged; missing height keeps the
      // 9 ft basis (surfaced by the missing-height sanity flag).
      if (cond.heightFt && cond.heightFt > STUD_STOCK_FT) base1 *= cond.heightFt / STUD_STOCK_FT;
    } else {
      // ordered so opening deductions land on the single FACE before doubling to both sides
      let q = cond.value * c.per;
      if (c.useHeight && cond.heightFt) q *= cond.heightFt;           // LF × h → single-face area
      if (c.netOpenings && cond.openingsSf) q = Math.max(0, q - cond.openingsSf); // remove openings, that face
      if (c.useThickness && cond.thicknessIn) q *= cond.thicknessIn / 12;         // area → volume
      if (c.bothSides) q *= 2;                                        // both faces
      base1 = q;
    }

    const waste = c.wastePct ?? 0;
    // round the ordered qty PER INSTANCE (ceil applies to each discrete unit), then × N identical
    let qty1 = base1 * (1 + waste / 100);
    qty1 = c.round === 'ceil' ? Math.ceil(qty1) : round2(qty1);
    const qty = round2(qty1 * instN);
    const baseQty = round2(base1 * instN); // Net (pre-waste, all instances)

    // ---- price + cost-bucket routing (region scales catalog rates, not tenant overrides) ----
    const unitMaterialCents = unitCostCents(c.costKey, rates, region);
    // Opt-in learned win/loss competitive multiplier for this CSI division (bounded
    // 0.85–1.15 upstream). OFF by default → wf = 1 → extended + labor stay byte-identical.
    const wf = o?.applyWinFactors ? (o.winFactorByDivision?.[(c.csi || '').slice(0, 2)] ?? 1) : 1;
    const extended = Math.round(qty * unitMaterialCents * wf);
    const ct = c.costType ?? 'material';
    const materialCents = ct === 'material' ? extended : 0;
    const equipmentCents = ct === 'equipment' ? extended : 0;
    const subCents = ct === 'sub' ? extended : 0;

    // ---- labor: per-trade bare wage × pre-waste base × instances (burden applied once at rollup) ----
    const crew = crewRateForTrade(c.trade, c.csi, { crewRatesCents: o?.crewRatesCents, crewRateCents, regionMultiplier: region });
    const laborHrs = round2((c.laborHrsPerUnit ?? 0) * base1 * instN);
    const laborCents = Math.round(laborHrs * crew * wf);

    return {
      conditionId: cond.id, assemblyId: asm.id, key: c.key, name: c.name, csi: c.csi, trade: c.trade,
      qty, baseQty, unit: c.unit, wastePct: waste,
      ...(instN > 1 ? { instanceCount: instN } : {}),
      crewRateCents: crew,
      ...(cond.building ? { building: cond.building } : {}),
      ...(cond.level ? { level: cond.level } : {}),
      ...(cond.zone ? { zone: cond.zone } : {}),
      costKey: c.costKey, unitMaterialCents, rateSource: rateSourceFor(c.costKey, rates),
      costType: ct, materialCents, equipmentCents, subCents,
      laborHrs, laborCents, totalCents: extended + laborCents,
      ...(wf !== 1 ? { competitiveFactor: wf } : {}),
      source: 'measured' as const,
    };
  });
}
