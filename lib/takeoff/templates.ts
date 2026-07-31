/**
 * Building-type takeoff templates — the "60-second first success" starter sets.
 *
 * Each template is a curated list of REAL assemblies (ids straight out of assemblies.ts)
 * that a given building type almost always needs. Picking one drops these as conditions
 * with value 0 ("needs measurement") so the shared computeTakeoff engine prices them LIVE
 * as the estimator traces each on the plan. Pure data + a helper — no engine changes, no AI.
 *
 * Every `assemblyId` below is validated against ASSEMBLIES at build time by the picker;
 * `kind` always equals that assembly's `appliesTo` so the manual add-form + tracer agree.
 */
import type { MeasureKind } from './types';

/** One seeded condition inside a template. `heightFt`/`thicknessIn` pre-fill the modifiers
 *  the assembly uses (wall height, slab/wall thickness) so it prices sensibly once traced. */
export interface TemplateCondition {
  name: string;
  kind: MeasureKind;
  assemblyId: string;
  heightFt?: number;
  thicknessIn?: number;
}

export interface BuildingTemplate {
  id: string;
  name: string;
  blurb: string;
  /** phosphor icon name the picker maps to a component (falls back gracefully). */
  icon?: string;
  conditions: TemplateCondition[];
}

export const BUILDING_TEMPLATES: BuildingTemplate[] = [
  {
    id: 'office_ti',
    name: 'Office TI',
    blurb: 'Tenant improvement build-out: partitions, ceilings, finishes, light MEP.',
    icon: 'Buildings',
    conditions: [
      { name: 'Interior partitions', kind: 'linear', assemblyId: 'interior_partition', heightFt: 10 },
      { name: 'Suspended ACT ceiling', kind: 'area', assemblyId: 'acoustic_ceiling' },
      { name: 'Carpet tile', kind: 'area', assemblyId: 'flooring_carpet' },
      { name: 'Resilient wall base', kind: 'linear', assemblyId: 'wall_base' },
      { name: 'Wall paint', kind: 'area', assemblyId: 'paint_walls' },
      { name: 'Interior doors', kind: 'count', assemblyId: 'wood_door' },
      { name: 'Light fixtures', kind: 'count', assemblyId: 'light_fixtures' },
      { name: 'Receptacles & switches', kind: 'count', assemblyId: 'wiring_devices' },
      { name: 'Data drops', kind: 'count', assemblyId: 'data_drops' },
      { name: 'HVAC allowance', kind: 'area', assemblyId: 'hvac_allowance' },
      { name: 'Fire sprinkler', kind: 'area', assemblyId: 'fire_sprinkler' },
    ],
  },
  {
    id: 'warehouse',
    name: 'Warehouse / Distribution',
    blurb: 'Shell & core: slab, tilt/CIP walls, steel roof structure, high-bay MEP.',
    icon: 'Warehouse',
    conditions: [
      { name: 'Slab-on-grade', kind: 'area', assemblyId: 'slab_on_grade_heavy', thicknessIn: 6 },
      { name: 'Tilt / CIP concrete walls', kind: 'area', assemblyId: 'concrete_wall', thicknessIn: 8 },
      { name: 'Steel roof deck', kind: 'area', assemblyId: 'roof_deck' },
      { name: 'TPO membrane roof', kind: 'area', assemblyId: 'roof_tpo' },
      { name: 'Open-web bar joists', kind: 'linear', assemblyId: 'bar_joist' },
      { name: 'Steel columns', kind: 'count', assemblyId: 'steel_column' },
      { name: 'Fire sprinkler', kind: 'area', assemblyId: 'fire_sprinkler' },
      { name: 'Electrical allowance', kind: 'area', assemblyId: 'electrical_allowance' },
      { name: 'High-bay lighting', kind: 'count', assemblyId: 'light_fixtures' },
      { name: 'Man doors', kind: 'count', assemblyId: 'door_frame' },
    ],
  },
  {
    id: 'retail_shell',
    name: 'Retail Shell',
    blurb: 'Vanilla shell: slab, CMU demising, storefront glazing, roof, stubbed MEP.',
    icon: 'Storefront',
    conditions: [
      { name: 'Slab-on-grade', kind: 'area', assemblyId: 'slab_on_grade', thicknessIn: 4 },
      { name: 'CMU demising walls', kind: 'area', assemblyId: 'cmu_wall' },
      { name: 'Aluminum storefront', kind: 'area', assemblyId: 'aluminum_storefront' },
      { name: 'Steel roof deck', kind: 'area', assemblyId: 'roof_deck' },
      { name: 'TPO membrane roof', kind: 'area', assemblyId: 'roof_tpo' },
      { name: 'Bar joists', kind: 'linear', assemblyId: 'bar_joist' },
      { name: 'Steel columns', kind: 'count', assemblyId: 'steel_column' },
      { name: 'HVAC allowance', kind: 'area', assemblyId: 'hvac_allowance' },
      { name: 'Electrical allowance', kind: 'area', assemblyId: 'electrical_allowance' },
      { name: 'Fire sprinkler', kind: 'area', assemblyId: 'fire_sprinkler' },
      { name: 'Hollow-metal doors', kind: 'count', assemblyId: 'door_frame' },
    ],
  },
  {
    id: 'restaurant_ti',
    name: 'Restaurant TI',
    blurb: 'Front-and-back-of-house: tile & LVT, kitchen ceilings, heavy plumbing & HVAC.',
    icon: 'ForkKnife',
    conditions: [
      { name: 'Interior partitions', kind: 'linear', assemblyId: 'interior_partition', heightFt: 10 },
      { name: 'Kitchen / restroom tile floor', kind: 'area', assemblyId: 'flooring_tile' },
      { name: 'Dining LVT floor', kind: 'area', assemblyId: 'flooring_lvt' },
      { name: 'Dining ACT ceiling', kind: 'area', assemblyId: 'acoustic_ceiling' },
      { name: 'Kitchen gyp-board ceiling', kind: 'area', assemblyId: 'gypsum_ceiling' },
      { name: 'Wall paint', kind: 'area', assemblyId: 'paint_walls' },
      { name: 'Plumbing fixtures', kind: 'count', assemblyId: 'plumbing_fixtures' },
      { name: 'Plumbing rough-in', kind: 'count', assemblyId: 'plumbing_rough' },
      { name: 'HVAC allowance', kind: 'area', assemblyId: 'hvac_allowance' },
      { name: 'Electrical allowance', kind: 'area', assemblyId: 'electrical_allowance' },
      { name: 'Fire sprinkler', kind: 'area', assemblyId: 'fire_sprinkler' },
      { name: 'Toilet partitions', kind: 'count', assemblyId: 'toilet_partitions' },
      { name: 'Toilet accessories', kind: 'count', assemblyId: 'toilet_accessories' },
      { name: 'Wood doors', kind: 'count', assemblyId: 'wood_door' },
    ],
  },
  {
    id: 'medical_dental',
    name: 'Medical / Dental',
    blurb: 'Clinical fit-out: partitions, hygienic finishes, op sinks, dense power & data.',
    icon: 'Tooth',
    conditions: [
      { name: 'Interior partitions', kind: 'linear', assemblyId: 'interior_partition', heightFt: 10 },
      { name: 'Suspended ACT ceiling', kind: 'area', assemblyId: 'acoustic_ceiling' },
      { name: 'Sheet / LVT flooring', kind: 'area', assemblyId: 'flooring_lvt' },
      { name: 'Hygienic wall covering', kind: 'area', assemblyId: 'wall_covering' },
      { name: 'Wall paint', kind: 'area', assemblyId: 'paint_walls' },
      { name: 'Resilient wall base', kind: 'linear', assemblyId: 'wall_base' },
      { name: 'Op / exam sinks', kind: 'count', assemblyId: 'plumbing_fixtures' },
      { name: 'Plumbing rough-in', kind: 'count', assemblyId: 'plumbing_rough' },
      { name: 'Wood doors', kind: 'count', assemblyId: 'wood_door' },
      { name: 'Light fixtures', kind: 'count', assemblyId: 'light_fixtures' },
      { name: 'Receptacles & switches', kind: 'count', assemblyId: 'wiring_devices' },
      { name: 'Data drops', kind: 'count', assemblyId: 'data_drops' },
      { name: 'HVAC allowance', kind: 'area', assemblyId: 'hvac_allowance' },
      { name: 'Fire sprinkler', kind: 'area', assemblyId: 'fire_sprinkler' },
    ],
  },
  {
    id: 'multifamily_unit',
    name: 'Multifamily Unit',
    blurb: 'Per-unit wood-framed build: walls, insulation, floors, fixtures, devices.',
    icon: 'HouseLine',
    conditions: [
      { name: 'Interior wood-stud walls', kind: 'linear', assemblyId: 'wood_stud_wall', heightFt: 9 },
      { name: 'Batt insulation', kind: 'area', assemblyId: 'batt_insulation' },
      { name: 'Gyp-board ceiling', kind: 'area', assemblyId: 'gypsum_ceiling' },
      { name: 'Living / kitchen LVT', kind: 'area', assemblyId: 'flooring_lvt' },
      { name: 'Bedroom carpet', kind: 'area', assemblyId: 'flooring_carpet' },
      { name: 'Bath tile', kind: 'area', assemblyId: 'flooring_tile' },
      { name: 'Wall paint', kind: 'area', assemblyId: 'paint_walls' },
      { name: 'Resilient wall base', kind: 'linear', assemblyId: 'wall_base' },
      { name: 'Interior doors', kind: 'count', assemblyId: 'wood_door' },
      { name: 'Kitchen & bath fixtures', kind: 'count', assemblyId: 'plumbing_fixtures' },
      { name: 'Light fixtures', kind: 'count', assemblyId: 'light_fixtures' },
      { name: 'Receptacles & switches', kind: 'count', assemblyId: 'wiring_devices' },
    ],
  },
  {
    id: 'tenant_demo',
    name: 'Tenant Demo',
    blurb: 'Selective demolition scoping — quantify what comes out, then set demo rates in your cost book.',
    icon: 'Hammer',
    conditions: [
      { name: 'Demo partitions', kind: 'linear', assemblyId: 'interior_partition', heightFt: 10 },
      { name: 'Demo ceiling', kind: 'area', assemblyId: 'acoustic_ceiling' },
      { name: 'Demo flooring', kind: 'area', assemblyId: 'flooring' },
      { name: 'Demo wall base', kind: 'linear', assemblyId: 'wall_base' },
      { name: 'Remove doors', kind: 'count', assemblyId: 'wood_door' },
      { name: 'Remove light fixtures', kind: 'count', assemblyId: 'light_fixtures' },
      { name: 'Remove plumbing fixtures', kind: 'count', assemblyId: 'plumbing_fixtures' },
    ],
  },
];

/** The seeded conditions for a template id (empty array for unknown ids / 'blank'). */
export function conditionsForTemplate(id: string): TemplateCondition[] {
  return BUILDING_TEMPLATES.find((t) => t.id === id)?.conditions ?? [];
}

export const templateById = (id: string): BuildingTemplate | undefined =>
  BUILDING_TEMPLATES.find((t) => t.id === id);
