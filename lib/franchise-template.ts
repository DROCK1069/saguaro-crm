/**
 * lib/franchise-template.ts — the standardized Franchise Rollout playbook.
 * One indoor-golf location, defined once. "Launch New Site" instantiates this
 * against a start date so every location runs the same proven process
 * (Core Value: Consistency; Pillar: Execute with Consistency).
 */

export interface RolloutStage {
  id: string;
  label: string;
  color: string;
  order: number;
  weeks: string; // target duration per the SCS Franchise Rollout Workflow table
}

// The 8-stage Franchise Rollout Workflow, verbatim from the SCS spec table
// (Site Selection → Training & Opening), left → right, each with its target duration.
export const ROLLOUT_STAGES: RolloutStage[] = [
  { id: 'site_selection',  label: 'Site Selection',      color: '#8E8E93', order: 0, weeks: '2–4 wk' },
  { id: 'design',          label: 'Design',              color: '#007AFF', order: 1, weeks: '6–8 wk' },
  { id: 'permitting',      label: 'Permitting',          color: '#AF52DE', order: 2, weeks: '4–12+ wk' },
  { id: 'procurement',     label: 'Procurement',         color: '#5AC8FA', order: 3, weeks: 'Parallel' },
  { id: 'construction',    label: 'Construction',        color: '#FF9500', order: 4, weeks: '10–16 wk' },
  { id: 'equipment_tech',  label: 'Equipment & Tech',    color: '#FF375F', order: 5, weeks: '2–3 wk' },
  { id: 'inspections_co',  label: 'Inspections & CO',    color: '#FFCC00', order: 6, weeks: '1–2 wk' },
  { id: 'training_opening',label: 'Training & Opening',  color: '#34C759', order: 7, weeks: '1 wk' },
];
export const STAGE_IDS = ROLLOUT_STAGES.map((s) => s.id);
export const STAGE_META: Record<string, RolloutStage> = Object.fromEntries(ROLLOUT_STAGES.map((s) => [s.id, s]));
export const isStage = (v: any): boolean => typeof v === 'string' && STAGE_IDS.includes(v);

// "Every Project Has the Same Folder Structure. Nothing is stored differently."
// Standardized document folders stamped on every launched location.
export const STANDARD_FOLDERS = [
  '01 Contracts', '02 Permits', '03 Drawings', '04 RFIs', '05 Submittals', '06 Change Orders',
  '07 Schedule', '08 Photos', '09 Inspections', '10 Punch List', '11 Closeout', '12 Warranty',
];

/* ── Template row definitions (relative day offsets from project start) ── */

interface TplPhase { name: string; phase_number: number; start: number; end: number; }
interface TplMilestone { title: string; day: number; critical: boolean; type: string; }
interface TplLongLead { item: string; qty: number; unit: string; neededDay: number; leadDays: number; unitCost: number; }
interface TplRisk { title: string; category: string; likelihood: string; impact: string; score: number; mitigation: string; }

export const GOLF_TEMPLATE = {
  name: 'Indoor Golf Franchise Location',
  phases: [
    { name: 'Site Selection & LOI',       phase_number: 1, start: 0,   end: 30 },
    { name: 'Design & Development',        phase_number: 2, start: 30,  end: 90 },
    { name: 'Permitting',                  phase_number: 3, start: 75,  end: 135 },
    { name: 'Construction',                phase_number: 4, start: 135, end: 285 },
    { name: 'Commissioning & FF&E',        phase_number: 5, start: 270, end: 300 },
    { name: 'Grand Opening',               phase_number: 6, start: 300, end: 310 },
  ] as TplPhase[],
  // Full indoor-golf milestone schedule (per the SCS spec).
  milestones: [
    { title: 'LOI Executed',                 day: 15,  critical: true,  type: 'milestone' },
    { title: 'Lease Signed',                 day: 30,  critical: true,  type: 'milestone' },
    { title: 'Design Development Complete',  day: 90,  critical: true,  type: 'design' },
    { title: 'Permit Submitted',             day: 100, critical: false, type: 'permit' },
    { title: 'Permit Approved',              day: 135, critical: true,  type: 'permit' },
    { title: 'Demolition',                   day: 140, critical: false, type: 'construction' },
    { title: 'Underground',                  day: 150, critical: false, type: 'construction' },
    { title: 'Framing',                      day: 165, critical: false, type: 'construction' },
    { title: 'MEP Rough-In',                 day: 185, critical: false, type: 'construction' },
    { title: 'Simulator Blocking',           day: 195, critical: true,  type: 'construction' },
    { title: 'Electrical Complete',          day: 210, critical: false, type: 'construction' },
    { title: 'Network Complete',             day: 215, critical: false, type: 'construction' },
    { title: 'Drywall',                      day: 225, critical: false, type: 'construction' },
    { title: 'Paint',                        day: 235, critical: false, type: 'construction' },
    { title: 'Flooring',                     day: 245, critical: false, type: 'construction' },
    { title: 'Millwork',                     day: 250, critical: false, type: 'construction' },
    { title: 'Simulator Installation',       day: 255, critical: true,  type: 'equipment' },
    { title: 'Impact Screen Install',        day: 260, critical: false, type: 'equipment' },
    { title: 'Turf Install',                 day: 265, critical: false, type: 'equipment' },
    { title: 'Lighting Commissioning',       day: 270, critical: false, type: 'equipment' },
    { title: 'AV Install',                   day: 275, critical: false, type: 'equipment' },
    { title: 'POS Install',                  day: 280, critical: false, type: 'equipment' },
    { title: 'Furniture',                    day: 285, critical: false, type: 'equipment' },
    { title: 'Final Inspection',             day: 292, critical: true,  type: 'inspection' },
    { title: 'Certificate of Occupancy',     day: 295, critical: true,  type: 'milestone' },
    { title: 'Training',                     day: 300, critical: false, type: 'milestone' },
    { title: 'Soft Opening',                 day: 302, critical: false, type: 'milestone' },
    { title: 'Grand Opening',                day: 305, critical: true,  type: 'milestone' },
  ] as TplMilestone[],
  longLead: [
    { item: 'Full-Swing golf simulators + launch monitors', qty: 12, unit: 'bay', neededDay: 210, leadDays: 90,  unitCost: 22000 },
    { item: 'Simulator enclosures + impact screens',      qty: 12, unit: 'bay', neededDay: 220, leadDays: 75,  unitCost: 6500 },
    { item: 'Premium hitting turf + putting green',       qty: 1,  unit: 'lot', neededDay: 240, leadDays: 45,  unitCost: 38000 },
    { item: 'Short-throw projectors + AV racks',          qty: 12, unit: 'ea',  neededDay: 235, leadDays: 60,  unitCost: 3200 },
    { item: 'Rooftop HVAC RTU — bar/lounge',              qty: 1,  unit: 'ea',  neededDay: 200, leadDays: 100, unitCost: 42000 },
    { item: 'Bar / lounge millwork package',              qty: 1,  unit: 'lot', neededDay: 250, leadDays: 70,  unitCost: 55000 },
    { item: 'Electrical switchgear / distribution',       qty: 1,  unit: 'ea',  neededDay: 180, leadDays: 110, unitCost: 48000 },
    { item: 'Storefront + entry glass / doors',           qty: 1,  unit: 'lot', neededDay: 190, leadDays: 65,  unitCost: 32000 },
    { item: 'Specialty lighting package',                 qty: 1,  unit: 'lot', neededDay: 255, leadDays: 50,  unitCost: 21000 },
  ] as TplLongLead[],
  risks: [
    { title: 'Long-lead procurement slips past opening', category: 'Procurement', likelihood: 'High',   impact: 'High',   score: 16, mitigation: 'Release POs at design-freeze; hold backup vendors on standby.' },
    { title: 'Permitting / landlord approval delay',     category: 'Permitting',  likelihood: 'Medium', impact: 'High',   score: 12, mitigation: 'Pre-submittal meeting; weekly city check-ins; landlord LOI milestones.' },
    { title: 'Franchise AV / brand standard finalization', category: 'Design',    likelihood: 'Medium', impact: 'Medium', score: 9,  mitigation: 'Lock franchisor AV spec before procurement window opens.' },
    { title: 'Landlord delivery / turnover delay',       category: 'Schedule',    likelihood: 'Medium', impact: 'High',   score: 12, mitigation: 'Turnover milestone in lease with delay remedies.' },
    { title: 'Skilled labor availability',               category: 'Schedule',    likelihood: 'Medium', impact: 'Medium', score: 9,  mitigation: 'Award trades early; secure crews at buyout.' },
  ] as TplRisk[],
};

// Standardized weekly OAC meeting agenda (per the SCS spec).
export const OAC_AGENDA = [
  'Safety', 'Schedule', 'Critical Path', 'Budget', 'RFIs', 'Submittals',
  'Change Orders', 'Inspections', 'Long Lead Items', 'Owner Decisions', 'Open Issues', 'Action Items',
];

// QC checklist by trade — QC occurs before inspections (per the spec).
export const QC_TRADES = [
  'Concrete', 'Framing', 'Drywall', 'Paint', 'Flooring', 'Electrical', 'Plumbing',
  'HVAC', 'Millwork', 'Golf Equipment', 'AV', 'Networking', 'Signage', 'Final Cleaning',
];

// Pre-Site Inspection / feasibility due-diligence — run during Site Selection,
// BEFORE lease + build, to confirm a prospective location can actually take an
// indoor-golf TI. Each item is Pass (ok) / Flag (issue) / open.
export const PRESITE_CHECKLIST = [
  'Clear ceiling height adequate for sim bays (≥ 10–12 ft to structure)',
  'Column spacing / structure supports impact screens + blocking',
  'Slab condition & floor flatness acceptable for turf/putting',
  'Electrical service capacity (amps) sufficient for sim + AV load',
  'HVAC / rooftop unit capacity adequate for occupancy + equipment',
  'Plumbing & restroom count meets occupancy for bar/lounge',
  'Fire sprinkler coverage / life-safety adequate or scoped',
  'ADA access & egress compliant (or path to compliance)',
  'Internet / fiber available for POS, AV, and networking',
  'Storefront & signage allowance confirmed (landlord + city)',
  'Parking count adequate for projected occupancy',
  'Existing conditions match Tenant–Landlord Work Letter deliverables',
  'As-built / prior permit documents obtained',
  'Utility servicer identified; service can start before Full-Swing install',
  'Zoning / use permits indoor golf + bar/lounge',
];

// The Phase 1–4 operating checklist, verbatim from the SCS operating spec.
export const CHECKLIST_TEMPLATE: { phase: string; items: string[] }[] = [
  { phase: 'Phase 1 — Site Selection & Lease', items: [
    'Assist with layout/design + rough build-out budget for lease negotiation',
    'Invite vetted local GCs to bid',
    'Preliminary site photos',
    'Send prior as-built documents to architect',
    'Virtual site walk with Owner/Franchisee',
    'Utilities review — servicer, requirements, timing vs Full-Swing install, account setup',
    'Review Tenant–Landlord Work Letter / verify existing conditions',
    'Establish educated budget with Owner and verify against scope',
    'Request multiple bids from preferred/vetted GCs',
    'Establish projected construction schedule (target start/completion)',
  ] },
  { phase: 'Phase 2 — Design, Bids, Permit & Contracts', items: [
    'Assist Architect/MEP with design & drawings (preliminary bid set)',
    'Confirm local GCs meet Saguaro Control criteria + references',
    'Request and review bids with Owner/Franchisee',
    'Submit permit drawings to municipality',
    'Facilitate permit issuance with plan reviewers',
    'Award GC contract prior to permit issuance',
    'Execute written GC contract (signed, scope, timeline, delay fees)',
    'Set up invoice processing through Saguaro (lien releases, 10% retainage)',
  ] },
  { phase: 'Phase 3 — Construction', items: [
    'Start on time and on budget',
    'Coordinate equipment install dates (Full-Swing)',
    'Fire & Life Safety deferred submittals (sprinklers, alarms, access control)',
    'Signage — planning review with city + approvals',
    'Review project photos, schedule, and checklists',
    'Regular budget reviews (work completed vs paid out)',
    'Weekly meetings and owner updates',
    'Coordinate change orders',
  ] },
  { phase: 'Phase 4 — Post-Construction & Warranty', items: [
    'Checklists signed off',
    'Punchlist and project signed complete',
    'Final invoices paid',
    'Lien releases signed / notarized / completed',
    'Certificate of Occupancy issued',
    'Project closed',
    'TI reimbursement paperwork provided to Owner/Franchisee',
    'Written warranty from GC received',
  ] },
];

const iso = (startMs: number, offsetDays: number) => new Date(startMs + offsetDays * 86400000).toISOString().slice(0, 10);

/** Build ready-to-insert rows for a new location, dated from startMs. */
export function buildTemplateRows(tenantId: string, projectId: string, startMs: number) {
  const T = GOLF_TEMPLATE;
  const phases = T.phases.map((p) => ({
    tenant_id: tenantId, project_id: projectId, name: p.name, phase_number: p.phase_number,
    start_date: iso(startMs, p.start), end_date: iso(startMs, p.end), status: 'not_started', sort_order: p.phase_number,
  }));
  const milestones = T.milestones.map((m, i) => ({
    tenant_id: tenantId, project_id: projectId, title: m.title, milestone_type: m.type,
    baseline_date: iso(startMs, m.day), current_date: iso(startMs, m.day), float_days: 0,
    status: 'not started', is_critical_path: m.critical, sort_order: i + 1,
  }));
  const longLead = T.longLead.map((l) => ({
    tenant_id: tenantId, project_id: projectId, item_description: l.item, quantity: l.qty, unit: l.unit,
    needed_by_date: iso(startMs, l.neededDay), lead_time_days: l.leadDays, unit_cost: l.unitCost,
    status: 'pending', is_long_lead: true,
  }));
  const risks = T.risks.map((r) => ({
    tenant_id: tenantId, project_id: projectId, risk_title: r.title, risk_category: r.category,
    likelihood: r.likelihood, impact: r.impact, risk_score: r.score, mitigation_plan: r.mitigation,
    status: 'open', is_active: true,
  }));
  // Standardized 01–12 document folders (empty file_url is a folder marker).
  const folders = STANDARD_FOLDERS.map((f) => ({
    tenant_id: tenantId, project_id: projectId, file_name: '.keep', file_url: '', folder: f, category: 'folder', is_current: false,
  }));
  // Phase 1–4 operating checklist as project todos.
  const checklist = CHECKLIST_TEMPLATE.flatMap((g, gi) => g.items.map((item, ii) => ({
    tenant_id: tenantId, project_id: projectId, title: item, description: g.phase,
    status: 'open', priority: 'medium', linked_module: 'phase_checklist', linked_id: `${gi + 1}.${ii + 1}`,
  })));
  // QC-by-trade checklist (one row per trade).
  const qc = QC_TRADES.map((trade, i) => ({
    tenant_id: tenantId, project_id: projectId, title: trade, description: 'QC by Trade',
    status: 'open', priority: 'medium', linked_module: 'qc_trade', linked_id: String(i + 1),
  }));
  // Pre-Site Inspection / feasibility checklist (one row per item).
  const preSite = PRESITE_CHECKLIST.map((item, i) => ({
    tenant_id: tenantId, project_id: projectId, title: item, description: 'Pre-Site Inspection',
    status: 'open', priority: 'high', linked_module: 'pre_site', linked_id: String(i + 1),
  }));
  return { phases, milestones, longLead, risks, folders, checklist, qc, preSite };
}
