/* SAGUARO TRANSLATE PROOF — proves the radio translation brain against the
 * LIVE stack + LIVE Anthropic API: inserts a Spanish CLAUDE-PROOF radio
 * message, runs translateRadioMessage directly (awaited here; the routes fire
 * it without await), and asserts detected_lang + English rendering land on
 * the row. Fixture fully cleaned up. Prints SKIPPED (exit 0) without a key. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import { translateRadioMessage } from '../lib/translate';

const env = fs.readFileSync('D:/saguaro-web/.env.local', 'utf8');
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim();
const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!);

const apiKey = process.env.ANTHROPIC_API_KEY || get('ANTHROPIC_API_KEY');
if (!apiKey) { console.log('SKIPPED — ANTHROPIC_API_KEY not configured'); process.exit(0); }
process.env.ANTHROPIC_API_KEY = apiKey;

const MARK = 'CLAUDE-PROOF-' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} — ${detail}`);
  ok ? pass++ : fail++;
};

async function main() {
  // stranded-fixture purge (radio tables cascade from channels)
  const { data: staleCh } = await db.from('radio_channels').select('id').like('name', 'CLAUDE-PROOF%');
  if (staleCh?.length) await db.from('radio_channels').delete().in('id', staleCh.map((c: any) => c.id));
  const { data: staleP } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF%');
  if (staleP?.length) {
    await db.from('radio_channels').delete().in('project_id', staleP.map((p: any) => p.id));
    await db.from('projects').delete().in('id', staleP.map((p: any) => p.id));
  }

  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;
  const { data: proj } = await db.from('projects').insert({ tenant_id: tenantId, name: MARK + ' project', status: 'active' } as never).select().single();
  const projectId = (proj as any).id;
  const { data: ch } = await db.from('radio_channels').insert({ tenant_id: tenantId, project_id: projectId, kind: 'project', name: MARK + ' channel', allow_subs: true } as never).select().single();
  const channelId = (ch as any).id;

  // ── T1: Spanish fixture message (same shape the POST routes insert) ──
  const SPANISH = 'Necesitamos más concreto en el segundo piso';
  const { data: msg, error: insErr } = await db.from('radio_messages').insert({
    tenant_id: tenantId, channel_id: channelId, project_id: projectId,
    sender_user_id: '00000000-0000-4000-8000-00000000a001', sender_name: MARK + ' Sub',
    kind: 'text', body: SPANISH,
  } as never).select().single();
  check('T1: Spanish fixture message inserted', !insErr && !!(msg as any)?.id, insErr ? insErr.message : String((msg as any)?.id));

  // ── T2-T4: translation brain (routes fire this un-awaited; harness awaits) ──
  await translateRadioMessage(db, (msg as any).id, SPANISH);

  const { data: row } = await db.from('radio_messages').select('detected_lang, translations').eq('id', (msg as any).id).single();
  const en = String((row as any)?.translations?.en || '');
  const es = String((row as any)?.translations?.es || '');
  check('T2: detected_lang = es', (row as any)?.detected_lang === 'es', `detected_lang ${(row as any)?.detected_lang}`);
  check('T3: English rendering exists and mentions concrete', !!en && /concrete/i.test(en), en ? `"${en}"` : 'no en translation');
  check('T4: Spanish rendering preserved', /concreto/i.test(es), es ? `"${es}"` : 'no es rendering');

  // ── cleanup ──
  await db.from('radio_channels').delete().eq('id', channelId); // cascades messages
  await db.from('projects').delete().eq('id', projectId);
  const { data: leftM } = await db.from('radio_messages').select('id').eq('channel_id', channelId);
  const { data: leftP } = await db.from('projects').select('id').eq('id', projectId);
  check('Z: fixture fully cleaned up (cascade verified)', (leftM || []).length === 0 && (leftP || []).length === 0, 'no test rows remain');

  console.log(`\n${fail === 0 ? 'TRANSLATE PROOF PASSED' : 'TRANSLATE PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
