/* SAGUARO MARKUP PROOF — proves the B1 markup contract against the LIVE stack:
 * canonical per-markup rows (image-pixel geometry in data jsonb + page_number),
 * markup comments on live columns (content/author_name), the punch-from-drawing
 * trio (punch_list_items + drawing_pins.page_number/punch_item_id + markup row),
 * and legacy-freehand tolerance (raw stroke-array data reads without error).
 * Fixture fully cleaned up. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const MARK = 'CLAUDE-PROOF-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

/** Mirrors the deprecated route's classifier: the legacy consolidated blob is
 *  the freehand row whose data is a bare stroke array (no `space` field). */
const isLegacyConsolidated = (m: any) => m.markup_type === 'freehand' && Array.isArray(m.data);

async function purgeProject(projectId: string) {
  const { data: mk } = await db.from('drawing_markups').select('id').eq('project_id', projectId);
  if (mk?.length) await db.from('drawing_markup_comments').delete().in('markup_id', mk.map((m: any) => m.id));
  await db.from('drawing_markups').delete().eq('project_id', projectId);
  await db.from('drawing_pins').delete().eq('project_id', projectId);
  await db.from('punch_list_items').delete().eq('project_id', projectId);
  await db.from('drawings').delete().eq('project_id', projectId);
  await db.from('projects').delete().eq('id', projectId);
}

async function main() {
  // stranded-fixture purge
  const { data: staleP } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF%');
  for (const p of staleP || []) await purgeProject((p as any).id);

  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;
  const { data: proj } = await db.from('projects').insert({ tenant_id: tenantId, name: MARK + ' project', status: 'active' } as never).select().single();
  const projectId = (proj as any).id;
  const { data: dwg, error: dwgErr } = await db.from('drawings').insert({
    tenant_id: tenantId, project_id: projectId, name: MARK + ' sheet',
    sheet_number: 'A-101', url: 'https://example.com/' + MARK + '.pdf',
  } as never).select().single();
  if (dwgErr) { console.error('fixture drawing insert failed:', dwgErr.message); process.exit(1); }
  const drawingId = (dwg as any).id;

  // ── M1: canonical cloud markup — image-pixel geometry + page_number ──
  const cloudData = {
    space: 'image', w: 3000, h: 2000,
    geometry: { x: 420, y: 610, w: 800, h: 450 },
    style: { color: '#EF4444', width: 3 },
  };
  const { data: cloud, error: cloudErr } = await db.from('drawing_markups').insert({
    tenant_id: tenantId, project_id: projectId, drawing_id: drawingId,
    markup_type: 'cloud', data: cloudData, page_number: 2, color: '#EF4444',
    created_by_name: MARK + ' Author',
  } as never).select().single();
  check('M1a: canonical cloud markup inserts on live columns', !cloudErr && !!(cloud as any)?.id, cloudErr ? cloudErr.message : `id ${(cloud as any)?.id}`);

  // GET-shape assertion (same select the canonical route runs)
  const { data: got, error: getErr } = await db.from('drawing_markups').select('*')
    .eq('project_id', projectId).eq('tenant_id', tenantId).eq('drawing_id', drawingId)
    .order('created_at', { ascending: true });
  const g0 = ((got || [])[0] as any) || {};
  check('M1b: GET shape — type/data.space/w/h/page_number round-trip',
    !getErr && g0.markup_type === 'cloud' && g0.data?.space === 'image' && g0.data?.w === 3000 && g0.data?.h === 2000 && g0.page_number === 2 && g0.color === '#EF4444',
    getErr ? getErr.message : `cloud in image space ${g0.data?.w}x${g0.data?.h}, page ${g0.page_number}`);

  // ── M2: comment on live columns (content / author_name) ──
  const { data: cmt, error: cmtErr } = await db.from('drawing_markup_comments').insert({
    markup_id: (cloud as any).id, content: MARK + ' verify this cloud', author_name: MARK + ' Reviewer',
  } as never).select().single();
  const { data: cmtBack } = await db.from('drawing_markup_comments').select('content, author_name').eq('markup_id', (cloud as any).id);
  check('M2: comment stores content/author_name (no comment/author cols)',
    !cmtErr && (cmtBack || []).length === 1 && (cmtBack![0] as any).content === MARK + ' verify this cloud' && (cmtBack![0] as any).author_name === MARK + ' Reviewer',
    cmtErr ? cmtErr.message : `1 comment, content + author_name round-trip`);

  // ── M3: punch-from-drawing trio — punch row + pin (page_number) + stamp markup ──
  const { data: punch, error: punchErr } = await db.from('punch_list_items').insert({
    tenant_id: tenantId, project_id: projectId, title: MARK + ' punch item',
    priority: 'medium', status: 'open', location: 'A-101 — ' + MARK + ' sheet',
  } as never).select().single();
  check('M3a: punch_list_items row (title NOT NULL, lowercase priority)', !punchErr && (punch as any)?.priority === 'medium' && (punch as any)?.status === 'open', punchErr ? punchErr.message : `punch ${(punch as any)?.id}`);

  const punchId = (punch as any)?.id;
  const { data: pin, error: pinErr } = await db.from('drawing_pins').insert({
    tenant_id: tenantId, project_id: projectId, drawing_id: drawingId,
    x: 41.2, y: 58.7, x_pct: 41.2, y_pct: 58.7, page_number: 2,
    pin_type: 'punch', entity_type: 'punch_item', entity_id: punchId, punch_item_id: punchId,
    title: MARK + ' punch item', status: 'open',
  } as never).select().single();
  check('M3b: drawing_pin with page_number + punch_item_id', !pinErr && (pin as any)?.page_number === 2 && (pin as any)?.entity_type === 'punch_item', pinErr ? pinErr.message : `pin ${(pin as any)?.id} on page ${(pin as any)?.page_number}`);

  const { error: stampErr } = await db.from('drawing_markups').insert({
    tenant_id: tenantId, project_id: projectId, drawing_id: drawingId,
    markup_type: 'stamp', page_number: 2, color: '#c03030',
    data: { space: 'image', w: 3000, h: 2000, geometry: { x: 1236, y: 1174 }, stamp: 'PUNCH' },
    created_by_name: MARK + ' Author',
  } as never);
  check('M3c: PUNCH stamp markup row', !stampErr, stampErr ? stampErr.message : 'stamp PUNCH stored');

  // pin → punch join proves the deep-link chain (?pin=<pinId> → punch item)
  const { data: joined } = await db.from('drawing_pins').select('punch_item_id').eq('id', (pin as any)?.id).single();
  const { data: joinedPunch } = await db.from('punch_list_items').select('title, status').eq('id', (joined as any)?.punch_item_id).maybeSingle();
  check('M3d: pin.punch_item_id joins to the punch row', (joinedPunch as any)?.title === MARK + ' punch item', `joined title "${(joinedPunch as any)?.title}"`);

  // ── M4: legacy freehand row (raw stroke array) still reads without error ──
  const legacyStrokes = [{ points: [{ x: 10, y: 20 }, { x: 30, y: 44 }], color: '#EF4444', width: 3 }];
  const { error: legErr } = await db.from('drawing_markups').insert({
    tenant_id: tenantId, project_id: projectId, drawing_id: drawingId,
    markup_type: 'freehand', data: legacyStrokes, 
  } as never);
  check('M4a: legacy freehand row (bare stroke array) inserts', !legErr, legErr ? legErr.message : 'raw array stored');

  let readOk = true, legacyFound = 0, canonicalFound = 0, legacyBlobLen = -1;
  try {
    // Tolerant read — mirrors the deprecated route's merge GET.
    const { data: all, error: allErr } = await db.from('drawing_markups').select('*')
      .eq('drawing_id', drawingId).eq('tenant_id', tenantId).order('updated_at', { ascending: false });
    if (allErr) throw allErr;
    for (const m of (all || []) as any[]) {
      if (isLegacyConsolidated(m)) legacyFound++;
      else if (m.data && typeof m.data === 'object' && (m.data as any).space === 'image') canonicalFound++;
    }
    const legacy = ((all || []) as any[]).find(isLegacyConsolidated);
    legacyBlobLen = Array.isArray(legacy?.data) ? legacy.data.length : -1;
  } catch { readOk = false; }
  check('M4b: mixed read — legacy blob + canonical rows, no crash',
    readOk && legacyFound === 1 && canonicalFound === 2 && legacyBlobLen === 1,
    `read ok: ${readOk}; ${legacyFound} legacy (blob len ${legacyBlobLen}), ${canonicalFound} canonical`);

  // ── purge ──
  await purgeProject(projectId);
  const { data: leftM } = await db.from('drawing_markups').select('id').eq('project_id', projectId);
  const { data: leftPin } = await db.from('drawing_pins').select('id').eq('project_id', projectId);
  const { data: leftPunch } = await db.from('punch_list_items').select('id').eq('project_id', projectId);
  const { data: leftProj } = await db.from('projects').select('id').eq('id', projectId);
  check('Z: fixture fully cleaned up',
    !(leftM || []).length && !(leftPin || []).length && !(leftPunch || []).length && !(leftProj || []).length,
    'no test rows remain');

  console.log(`\n${fail === 0 ? 'MARKUP PROOF PASSED' : 'MARKUP PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
