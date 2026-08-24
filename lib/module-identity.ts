/**
 * Module identity accents — the designated color per module, platform-wide.
 * MIRROR of D:/saguaro-web/lib/module-identity.ts — keep byte-identical.
 *
 * Discipline (no rainbow): the accent colors ONLY the module's icon chip,
 * count badges, active states, and section markers. Body text stays in the
 * neutral ramp; gold remains the money + primary-action color.
 * Palette = Sonoran family, every hue tuned for the dark ground.
 *
 * `vivid` is the chip-scale voice of the same hue: a saturated, deeper-ground
 * variant hand-tuned to sit UNDER a white/near-white (#F8FAFC) glyph — never
 * hue-on-hue. Chips and medallions only; prose never colorizes.
 */

export interface ModuleAccent {
  key: string;
  name: string;
  hex: string;    // icon / badge ink
  soft: string;   // ~12% tint chip fill
  ring: string;   // ~45% tint chip ring
  vivid?: string; // saturated chip ground — a WHITE glyph rides ON this color
}

const A = (key: string, name: string, hex: string, vivid: string): ModuleAccent => ({
  key, name, hex, soft: hex + '1F', ring: hex + '73', vivid,
});

export const MODULE_ACCENTS: Record<string, ModuleAccent> = Object.fromEntries([
  // Field
  A('daily',      'Daily Logs',       '#E8B04B', '#F59E0B'), // sun amber
  A('photos',     'Photos',           '#7FA3C7', '#3B82F6'), // steel blue
  A('punch',      'Punch List',       '#C96F5E', '#E2593F'), // terracotta
  A('rfis',       'RFIs',             '#9C8FBF', '#8B5CF6'), // slate violet
  A('time',       'Time Clock',       '#7FB09B', '#10B981'), // agave
  A('deliveries', 'Deliveries',       '#D98E5C', '#EA7A2E'), // copper
  A('safety',     'Safety',           '#E0644E', '#EF4444'), // signal red-clay
  A('inspections','Inspections',      '#8FB3A9', '#14B8A6'), // patina
  // Execution
  A('schedule',   'Schedule',         '#9BB07F', '#65A30D'), // sage
  A('drawings',   'Drawings',         '#7F96C7', '#4C6EF5'), // blueprint blue
  A('specs',      'Specs',            '#A9A2C4', '#8672DB'), // lavender gray
  A('documents',  'Documents',        '#B8A98A', '#D97706'), // parchment
  A('permits',    'Permits',          '#C7A97F', '#D69E2E'), // sandstone
  A('todos',      'To-Dos',           '#8FB3A9', '#14B8A6'), // patina
  A('messages',   'Messages',         '#7FA3C7', '#3B82F6'), // steel blue
  A('radio',      'Saguaro Radio',    '#F5B84D', '#F59E0B'), // brand gold-hi (comms flagship)
  // Money (gold family — money stays gold)
  A('payapps',    'Pay Applications', '#F5B84D', '#F59E0B'),
  A('budget',     'Budget',           '#E8B04B', '#F59E0B'),
  A('invoices',   'Invoices',         '#F5B84D', '#F59E0B'),
  A('bills',      'Bills',            '#D9B98A', '#D9A431'),
  A('changeorders','Change Orders',   '#E0A63C', '#E8930C'),
  A('contracts',  'Contracts',        '#D9B98A', '#D9A431'),
  A('waivers',    'Lien Waivers',     '#C7A97F', '#D69E2E'),
  // Preconstruction
  A('takeoff',    'Takeoff Studio',   '#E8B04B', '#F59E0B'),
  A('signal',     'Signal Studio',    '#F5B84D', '#F59E0B'),
  A('bids',       'Bids',             '#C78A8A', '#E2566E'), // desert rose
  A('estimates',  'Estimates',        '#D98E5C', '#EA7A2E'),
  A('catalog',    'Materials Catalog','#B8A98A', '#D97706'),
  // People
  A('subs',       'Subcontractors',   '#9BB07F', '#65A30D'),
  A('team',       'Team',             '#7FA3C7', '#3B82F6'),
  A('compliance', 'Compliance',       '#8FB3A9', '#14B8A6'),
  // Cross-project + workforce
  A('work',       'My Work',          '#5FB8C4', '#06B6D4'), // turquoise — the personal cross-project hub
  A('crews',      'Crews',            '#FB923C', '#F97316'), // workforce orange (mobile tools family)
  A('tm',         'T&M Tickets',      '#84BF8E', '#22C55E'), // ledger green — money-adjacent, never gold

  // ── The other 69 modules ────────────────────────────────────────────────
  // Until these existed, moduleAccent() fell through to the grey FALLBACK for
  // most of the app, so ~57 screens COULD NOT be given an identity even when a
  // developer tried — and Equipment shipped wearing the Crews orange as a
  // workaround. Every module now owns a hue in the Sonoran family. Rules kept:
  // money stays gold, safety-critical stays red-clay, and siblings share a
  // family while staying distinguishable at chip scale.

  // Preconstruction / bidding — desert rose family
  A('bidpackages',    'Bid Packages',       '#D4909A', '#E2566E'),
  A('bidintelligence','Bid Intelligence',   '#BE8FA8', '#C2549A'),
  A('bidleveling',    'Bid Leveling',       '#C79BAF', '#D1568C'),

  // Money — gold and ledger-green family
  A('commitments',    'Commitments',        '#D9B98A', '#D9A431'),
  A('directcosts',    'Direct Costs',       '#E0A63C', '#E8930C'),
  A('financials',     'Financials',         '#F5B84D', '#F59E0B'),
  A('changeevents',   'Change Events',      '#E0A63C', '#E8930C'),
  A('costcodes',      'Cost Codes',         '#D9B98A', '#D9A431'),
  A('certifiedpayroll','Certified Payroll', '#84BF8E', '#22C55E'),
  A('resourceplanning','Resource Planning', '#9BB07F', '#65A30D'),

  // Execution / correspondence — blueprint + indigo family
  A('submittals',     'Submittals',         '#8FA8D9', '#6366F1'),
  A('meetings',       'Meetings',           '#B49BC4', '#A855F7'),
  A('correspondence', 'Correspondence',     '#A8B0C7', '#7C8FE0'),
  A('transmittals',   'Transmittals',       '#9BA8C4', '#6D83D6'),
  A('instructions',   'Instructions',       '#8FA3B8', '#5B8DEF'),
  A('coordination',   'Coordination',       '#8FB3C7', '#0EA5E9'),
  A('forms',          'Forms',              '#B8A98A', '#D97706'),
  A('actionplans',    'Action Plans',       '#9FA8C4', '#7C7FE0'),

  // Field observation — red-clay + patina family
  A('fieldissues',    'Field Issues',       '#D97E6A', '#F0653F'),
  A('observations',   'Observations',       '#9FB8A0', '#16A34A'),
  A('closeout',       'Closeout',           '#8CC0A8', '#22C55E'),
  A('warranty',       'Warranty',           '#CFA96B', '#CA8A04'),
  A('selections',     'Selections',         '#C79BB0', '#DB2777'),
  A('insurance',      'Insurance',          '#93B8B0', '#0D9488'),

  // Assets & workforce — copper family (Equipment finally owns its own hue)
  A('equipment',      'Equipment',          '#D9A05C', '#EA8C1E'),
  A('fleet',          'Fleet',              '#CE9A63', '#E08A2A'),
  A('fleetasset',     'Fleet Asset',        '#CE9A63', '#E08A2A'),
  A('people',         'People',             '#7FA3C7', '#3B82F6'),
  A('contacts',       'Contacts',           '#8FA8C4', '#4C8DE0'),
  A('employeedetail', 'Employee',           '#7FA3C7', '#3B82F6'),
  A('approvals',      'Approvals',          '#A9B87F', '#84CC16'),

  // Command center — one coherent teal→indigo family, distinguishable at chip scale
  A('commandcenter',  'Command Center',     '#5FB8C4', '#06B6D4'),
  A('ccchecklists',   'Checklists',         '#6FB3B8', '#0FA8B8'),
  A('ccescalations',  'Escalations',        '#D97E6A', '#F0653F'),
  A('cckpis',         'KPIs',               '#7FB0C4', '#1FA2D6'),
  A('cclonglead',     'Long Lead',          '#8FA8C4', '#4C8DE0'),
  A('ccmilestones',   'Milestones',         '#9BB07F', '#65A30D'),
  A('ccoac',          'OAC Meetings',       '#B49BC4', '#A855F7'),
  A('ccownerupdates', 'Owner Updates',      '#A9A2C4', '#8672DB'),
  A('ccportals',      'Portals',            '#8FB3C7', '#0EA5E9'),
  A('ccpresite',      'Pre-Site',           '#C7A97F', '#D69E2E'),
  A('ccqc',           'Quality Control',    '#8FB3A9', '#14B8A6'),
  A('ccrisks',        'Risks',              '#E0644E', '#EF4444'),
  A('ccrollout',      'Rollout',            '#9FA8C4', '#7C7FE0'),
  A('ccvendors',      'Vendors',            '#D9A05C', '#EA8C1E'),
  A('ccverify',       'Verification',       '#8CC0A8', '#22C55E'),
  A('franchiserollout','Franchise Rollout', '#9FA8C4', '#7C7FE0'),

  // Intelligence & assistants
  A('sage',           'Sage',               '#9C8FBF', '#8B5CF6'),
  A('autopilot',      'Autopilot',          '#7FB0C4', '#1FA2D6'),
  A('askdocs',        'Ask Docs',           '#A9A2C4', '#8672DB'),
  A('voice',          'Voice Notes',        '#B49BC4', '#A855F7'),
  A('reports',        'Reports',            '#B8A98A', '#D97706'),
  A('scheduledreports','Scheduled Reports', '#B8A98A', '#D97706'),
  A('portfolio',      'Portfolio',          '#5FB8C4', '#06B6D4'),

  // Models & plan tools
  A('bim',            'BIM',                '#7F96C7', '#4C6EF5'),
  A('bimviewer',      'BIM Viewer',         '#7F96C7', '#4C6EF5'),

  // Platform / system surfaces
  A('notifications',  'Notifications',      '#C7A97F', '#D69E2E'),
  A('search',         'Search',             '#8FA8C4', '#4C8DE0'),
  A('bookmarks',      'Bookmarks',          '#C7A97F', '#D69E2E'),
  A('syncqueue',      'Sync Queue',         '#8FB3A9', '#14B8A6'),
  A('newproject',     'New Project',        '#9BB07F', '#65A30D'),
  A('w9',             'W-9',                '#B8A98A', '#D97706'),
].map((a) => [a.key, a]));

const FALLBACK = A('default', 'Module', '#CBD5E1', '#64748B');

/** Accent for a module key (route-ish string ok: '/daily', 'punch-list'...). */
export function moduleAccent(key?: string | null): ModuleAccent {
  if (!key) return FALLBACK;
  const k = String(key).toLowerCase().replace(/^\//, '').replace(/[-_\s]/g, '');
  const alias: Record<string, string> = {
    dailylogs: 'daily', dailylog: 'daily', punchlist: 'punch', rfi: 'rfis',
    timeclock: 'time', payapplications: 'payapps', payapp: 'payapps',
    changeorder: 'changeorders', lienwaivers: 'waivers', materialscatalog: 'catalog',
    subcontractors: 'subs', signalstudio: 'signal', takeoffstudio: 'takeoff',
    conversations: 'messages', saguaroradio: 'radio',
    // Route names that are the SAME module under another door — aliasing keeps
    // one identity per concept instead of two near-identical colors.
    measuredtakeoff: 'takeoff', coverageheatmap: 'signal', signaladvisor: 'signal',
    materials: 'catalog', costcatalog: 'catalog',
    primecontracts: 'contracts', contract: 'contracts',
    myitems: 'work', mywork: 'work',
    payapps: 'payapps', invoicing: 'invoices', invoice: 'invoices',
    dailies: 'daily', punchitems: 'punch', submittal: 'submittals',
    meeting: 'meetings', observation: 'observations', fieldissue: 'fieldissues',
    tmtickets: 'tm', tickets: 'tm', employees: 'people', directory: 'people',
  };
  const kk = alias[k] || k;
  return MODULE_ACCENTS[kk] || FALLBACK;
}
