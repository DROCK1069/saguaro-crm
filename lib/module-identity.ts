/**
 * Module identity accents — the designated color per module, platform-wide.
 * MIRROR of D:/saguaro-web/lib/module-identity.ts — keep byte-identical.
 *
 * Discipline (no rainbow): the accent colors ONLY the module's icon chip,
 * count badges, active states, and section markers. Body text stays in the
 * neutral ramp; gold remains the money + primary-action color.
 * Palette = Sonoran family, every hue tuned for the dark ground.
 */

export interface ModuleAccent {
  key: string;
  name: string;
  hex: string;   // icon / badge ink
  soft: string;  // ~12% tint chip fill
  ring: string;  // ~45% tint chip ring
}

const A = (key: string, name: string, hex: string): ModuleAccent => ({
  key, name, hex, soft: hex + '1F', ring: hex + '73',
});

export const MODULE_ACCENTS: Record<string, ModuleAccent> = Object.fromEntries([
  // Field
  A('daily',      'Daily Logs',       '#E8B04B'), // sun amber
  A('photos',     'Photos',           '#7FA3C7'), // steel blue
  A('punch',      'Punch List',       '#C96F5E'), // terracotta
  A('rfis',       'RFIs',             '#9C8FBF'), // slate violet
  A('time',       'Time Clock',       '#7FB09B'), // agave
  A('deliveries', 'Deliveries',       '#D98E5C'), // copper
  A('safety',     'Safety',           '#E0644E'), // signal red-clay
  A('inspections','Inspections',      '#8FB3A9'), // patina
  // Execution
  A('schedule',   'Schedule',         '#9BB07F'), // sage
  A('drawings',   'Drawings',         '#7F96C7'), // blueprint blue
  A('specs',      'Specs',            '#A9A2C4'), // lavender gray
  A('documents',  'Documents',        '#B8A98A'), // parchment
  A('permits',    'Permits',          '#C7A97F'), // sandstone
  A('todos',      'To-Dos',           '#8FB3A9'), // patina
  A('messages',   'Messages',         '#7FA3C7'), // steel blue
  A('radio',      'Saguaro Radio',    '#F5B84D'), // brand gold-hi (comms flagship)
  // Money (gold family — money stays gold)
  A('payapps',    'Pay Applications', '#F5B84D'),
  A('budget',     'Budget',           '#E8B04B'),
  A('invoices',   'Invoices',         '#F5B84D'),
  A('bills',      'Bills',            '#D9B98A'),
  A('changeorders','Change Orders',   '#E0A63C'),
  A('contracts',  'Contracts',        '#D9B98A'),
  A('waivers',    'Lien Waivers',     '#C7A97F'),
  // Preconstruction
  A('takeoff',    'Takeoff Studio',   '#E8B04B'),
  A('signal',     'Signal Studio',    '#F5B84D'),
  A('bids',       'Bids',             '#C78A8A'), // desert rose
  A('estimates',  'Estimates',        '#D98E5C'),
  A('catalog',    'Materials Catalog','#B8A98A'),
  // People
  A('subs',       'Subcontractors',   '#9BB07F'),
  A('team',       'Team',             '#7FA3C7'),
  A('compliance', 'Compliance',       '#8FB3A9'),
].map((a) => [a.key, a]));

const FALLBACK = A('default', 'Module', '#CBD5E1');

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
