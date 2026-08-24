/**
 * Shared takeoff engine — types. Measurement-driven, deterministic, integer-cents.
 * Mirrors lib/heatmap: pure TS, no DOM, identical on web + iOS.
 *
 * The chain: geometry (measured SF/LF/EA) → condition → assembly explosion →
 * priced line items → rollups. AI only proposes conditions; this engine computes.
 */

export type MeasureKind = 'area' | 'linear' | 'count';
export type Pt = { x: number; y: number };

/** A thing measured on the plan. `value` is the measured quantity in its base unit. */
export interface Condition {
  id: string;
  name: string;
  kind: MeasureKind;
  /** SF for area, LF for linear, EA for count */
  value: number;
  /** wall/opening height in ft (linear/area assemblies that need it) */
  heightFt?: number;
  /**
   * slab/footing thickness in inches (concrete assemblies).
   * NOTE: doubles as excavation/base DEPTH in inches for sitework area assemblies
   * (mass_excavation, aggregate_base) — same SF × (in/12) / 27 → CY math.
   */
  thicknessIn?: number;
  assemblyId: string;
  /** traceability — which sheet + the traced geometry (for audit + re-render) */
  sheet?: string;
  points?: Pt[];
  /** value provenance — 'traced' set from plan geometry, 'manual' typed by the estimator. Metadata only; pricing never reads it. */
  measured?: 'traced' | 'manual';

  // --- v2 optional measurement modifiers (omit all → v1 behavior) ---
  /** total SF of door/window openings on this wall run (single-face) — netted from face-area components */
  openingsSf?: number;
  /** number of framed openings in this run — drives extra jack/king/cripple studs */
  openingsCount?: number;
  /** stud/joist spacing override in inches (16 or 24); falls back to component default */
  studSpacingIn?: number;

  // --- v3: estimator productivity + bid structure (all optional; omit → prior behavior) ---
  /** "typical" instances — measure one unit, apply to N identical (default 1). Multiplies qty + labor. */
  instanceCount?: number;
  /** estimator note / assumption on this scope — surfaces in the proposal + open-questions list */
  note?: string;
  assumption?: string;
  /** flagged as an open question (spawn-RFI candidate) */
  flagged?: boolean;
  /** location breakdown for phasing / sub-scope rollups */
  building?: string;
  level?: string;
  zone?: string;
  /** bid structure: base scope by default, or a named add/deduct alternate (grouped by `alternate`) */
  alternate?: string;
  alternateType?: 'base' | 'add' | 'deduct';
}

/** A component formula inside an assembly — how ONE measured value explodes into a material/labor line. */
export interface AssemblyComponent {
  key: string;
  name: string;
  csi: string;            // CSI code, e.g. '09 29 00'
  trade: string;          // division label, e.g. 'Drywall'
  unit: string;           // output unit: SF, LF, EA, CY, HR, GAL…
  /** qty = base(condition) × per, with optional height/thickness multipliers (see engine) */
  per: number;
  useHeight?: boolean;    // multiply by heightFt
  useThickness?: boolean; // multiply by thicknessIn/12 (→ ft) for volume
  bothSides?: boolean;    // ×2 (e.g. drywall both faces)
  round?: 'ceil' | 'none';
  wastePct?: number;      // added to material qty
  costKey: string;        // → COST_CATALOG unit price (material, cents)
  laborHrsPerUnit?: number; // crew hours per output unit (pre-waste)

  // --- v2 optional formula controls (omit all → v1 behavior) ---
  /** subtract cond.openingsSf from the single-face area before bothSides */
  netOpenings?: boolean;
  /** cost bucket routing; default 'material' (preserves every current line byte-for-byte) */
  costType?: 'material' | 'labor' | 'equipment' | 'sub';
  /** special-case framing count instead of per-based qty (see engine explodeCondition) */
  qtyFormula?: 'studCount';
  /** default stud/joist spacing in inches for this component (16/24) */
  spacingIn?: number;
  /** fixed end studs added to a run (default 1) */
  endStuds?: number;
  /** extra studs per framed opening (king+jack+cripple ≈ 3–4) */
  openingStudAdder?: number;
  /** corners/intersections/backing/blocking allowance (~10–15%) */
  framingAllowancePct?: number;
}

export interface Assembly {
  id: string;
  name: string;
  appliesTo: MeasureKind;
  components: AssemblyComponent[];
}

/** A computed, priced line — the output. Everything traces back to conditionId. */
export interface LineItem {
  conditionId: string;
  assemblyId: string;
  key: string;
  name: string;
  csi: string;
  trade: string;
  qty: number;                   // ordered quantity = baseQty × (1 + waste%)
  /** pre-waste base quantity (Net) — waste transparency: Net | Waste% | Order(qty) */
  baseQty: number;
  unit: string;
  wastePct: number;
  /** identical instances this line represents (default 1) — from Condition.instanceCount */
  instanceCount?: number;
  /** crew wage (cents/hr) actually used for this line's labor — per-trade transparency */
  crewRateCents?: number;
  /** location tags copied from the condition (for byLocation rollups) */
  building?: string;
  level?: string;
  zone?: string;
  costKey: string;               // catalog key — enables the learning loop
  unitMaterialCents: number;     // the unit rate used (per unit, before qty)
  rateSource: 'tenant' | 'catalog'; // 'tenant' = this GC's learned/manual rate
  /** which cost bucket the extended unit cost routed to (default 'material') */
  costType: 'material' | 'labor' | 'equipment' | 'sub';
  materialCents: number;   // extended cost when costType==='material', else 0 (back-compat)
  /** extended cost when costType==='equipment', else 0/absent */
  equipmentCents?: number;
  /** extended cost when costType==='sub', else 0/absent */
  subCents?: number;
  laborHrs: number;
  laborCents: number;      // laborHrs × crew rate (bare wage; burden applied once at rollup)
  totalCents: number;      // routed extended cost + labor
  competitiveFactor?: number; // learned win/loss multiplier applied to this line (only set when ≠ 1)
  source: 'measured';
}

/** A tenant's learned/manual rate override, cents per unit, keyed by costKey. */
export type RateOverrides = Record<string, number>;

export interface LearnedRate { costKey: string; materialCents: number; samples: number }

export interface DivisionRoll { trade: string; materialCents: number; laborCents: number; totalCents: number; lines: number }

/** Location Breakdown Structure rollup — group base-bid lines by building / level / zone (phasing, sub scope). */
export interface LocationRoll { key: string; building?: string; level?: string; zone?: string; materialCents: number; laborCents: number; totalCents: number; lines: number }

/** A base-bid + alternates schedule entry — priced add/deduct with full markup, delta vs base. */
export interface AlternateRoll { label: string; type: 'add' | 'deduct'; materialCents: number; laborCents: number; sellCents: number; deltaCents: number; lines: number }

export interface SanityFlag { level: 'info' | 'warn'; code: string; message: string }

export interface TakeoffResult {
  lines: LineItem[];
  byDivision: DivisionRoll[];
  byLocation: LocationRoll[];         // v3: base-bid rollup by building/level/zone (empty when no location tags)
  alternates: AlternateRoll[];        // v3: priced add/deduct alternate schedule (empty when none)
  materialCents: number;
  laborCents: number;                 // bare labor (pre-burden), for readable line reporting
  equipmentCents: number;             // v2: equipment-bucket direct cost
  subCents: number;                   // v2: subcontractor-bucket direct cost
  materialTaxCents: number;           // v2: sales tax on material only
  burdenedLaborCents: number;         // v2: labor × (1 + laborBurdenPct)
  generalConditionsCents: number;     // v2: Div 01 project overhead
  subtotalCents: number;              // == directCost (material+tax+burdenedLabor+equip+sub); == old material+labor when tax/burden = 0
  overheadCents: number;
  profitCents: number;
  contingencyCents: number;
  bondCents: number;                  // v2: P&P bond premium on contract value
  sellCents: number;                  // full stacked sell price
  laborHrs: number;
  costPerSf: number | null;  // sellCents / buildingSf, if provided
  sanity: SanityFlag[];
}

export interface ComputeOpts {
  crewRateCents?: number;    // $/hr in cents — fallback for trades missing a per-trade rate (default 6500)
  /** per-trade crew wage (cents/hr), keyed by trade label OR 2-digit CSI division; wins over the per-trade defaults */
  crewRatesCents?: Record<string, number>;
  /** regional city-cost-index multiplier applied to CATALOG rates + default crew wages (tenant overrides unaffected). default 1 */
  regionMultiplier?: number;
  /** display label for the region (e.g. "Phoenix, AZ · CCI 0.96") — carried onto the proposal */
  regionLabel?: string;
  overheadPct?: number;
  profitPct?: number;
  contingencyPct?: number;
  buildingSf?: number;       // for $/SF + variance sanity
  historicalCostPerSf?: number; // for variance flag (dollars)
  rates?: RateOverrides;     // the GC's learned/manual unit costs (win over the book)

  // --- v2 optional markup stack (all default 0 → v1 behavior) ---
  salesTaxPct?: number;          // on MATERIAL only (default 0)
  laborBurdenPct?: number;       // payroll tax + WC + fringe on labor (default 0; typical 25–40)
  generalConditionsPct?: number; // Div 01 project overhead (default 0; typical 6–12)
  bondPct?: number;              // P&P bond premium on contract value (default 0; typical 1–3)
  costPerSfBand?: [number, number]; // sane $/SF window for plausibility (default [8000, 60000] cents)

  // --- win/loss competitive pricing (opt-in; default OFF → byte-identical v1 pricing) ---
  applyWinFactors?: boolean;                    // gate; when false/undefined, no adjustment
  winFactorByDivision?: Record<string, number>; // 2-digit CSI division → learned multiplier (0.85–1.15)
}
