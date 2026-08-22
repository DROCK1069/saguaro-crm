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
  };
  const kk = alias[k] || k;
  return MODULE_ACCENTS[kk] || FALLBACK;
}
