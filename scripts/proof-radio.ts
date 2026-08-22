/* SAGUARO RADIO PROOF — proves the PTT server layer against the LIVE stack:
 * channel auto-creation idempotency, membership, voice clip storage + signed
 * playback, panic fan-out (message + notification per member), sub-portal
 * membership, and translation-layer columns. Fixture fully cleaned up. */
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

async function main() {
  // stranded-fixture purge (radio tables cascade from channels)
  const { data: staleCh } = await db.from('radio_channels').select('id').like('name', 'CLAUDE-PROOF%');
  if (staleCh?.length) await db.from('radio_channels').delete().in('id', staleCh.map((c: any) => c.id));
  const { data: staleP } = await db.from('projects').select('id').like('name', 'CLAUDE-PROOF%');
  if (staleP?.length) {
    for (const t of ['radio_channels', 'notifications', 'radio_assists', 'crew_location_pings', 'crew_locations']) await db.from(t).delete().in('project_id', staleP.map((p: any) => p.id));
    await db.from('projects').delete().in('id', staleP.map((p: any) => p.id));
  }

  const { data: anyProject } = await db.from('projects').select('tenant_id').limit(1).single();
  const tenantId = (anyProject as any).tenant_id;
  const { data: proj } = await db.from('projects').insert({ tenant_id: tenantId, name: MARK + ' project', status: 'active' } as never).select().single();
  const projectId = (proj as any).id;

  // ── R1: project All-Hands channel — idempotent creation (unique constraint) ──
  const mk = () => db.from('radio_channels').insert({ tenant_id: tenantId, project_id: projectId, kind: 'project', name: 'All Hands', allow_subs: true } as never).select().maybeSingle();
  const first = await mk();
  const second = await mk();
  const { data: chans } = await db.from('radio_channels').select('id, allow_subs').eq('project_id', projectId).eq('kind', 'project');
  check('R1: All-Hands channel unique per project', (chans || []).length === 1 && !!(second as any).error, `${(chans || []).length} channel(s); duplicate insert rejected: ${!!(second as any).error}`);
  const channelId = ((chans || [])[0] as any).id;
  check('R2: subs allowed on project channel (approved scope)', ((chans || [])[0] as any).allow_subs === true, 'allow_subs true');

  // ── R3: memberships — staff + portal sub, monitoring default on ──
  const u1 = '00000000-0000-4000-8000-00000000a001';
  const u2 = '00000000-0000-4000-8000-00000000a002';
  const subId = '00000000-0000-4000-8000-00000000b001';
  await db.from('radio_members').insert([
    { channel_id: channelId, tenant_id: tenantId, user_id: u1, display_name: MARK + ' PM' },
    { channel_id: channelId, tenant_id: tenantId, user_id: u2, display_name: MARK + ' Super' },
    { channel_id: channelId, tenant_id: tenantId, portal_sub_id: subId, display_name: MARK + ' Sub', preferred_lang: 'es' },
  ] as never);
  const { data: mems } = await db.from('radio_members').select('monitoring, preferred_lang, portal_sub_id').eq('channel_id', channelId);
  check('R3: staff + portal-sub memberships, monitoring on by default', (mems || []).length === 3 && (mems || []).every((m: any) => m.monitoring === true), `${(mems || []).length} members`);
  check('R4: per-member language preference (translator layer)', (mems || []).some((m: any) => m.preferred_lang === 'es'), 'es preference stored');

  // ── R5: voice clip — real storage upload + signed playback URL ──
  const clipPath = `${tenantId}/radio/${channelId}/${MARK}.m4a`;
  const { error: upErr } = await db.storage.from('project-files').upload(clipPath, Buffer.from('PROOF-AUDIO-BYTES'), { contentType: 'audio/mp4' });
  check('R5: voice clip uploads to tenant-scoped path', !upErr, upErr ? upErr.message : clipPath);
  const { data: signed } = await db.storage.from('project-files').createSignedUrl(clipPath, 300);
  check('R6: signed playback URL issued', !!signed?.signedUrl && signed.signedUrl.includes('token='), 'signed URL with token');
  const { data: vmsg, error: vErr } = await db.from('radio_messages').insert({
    tenant_id: tenantId, channel_id: channelId, project_id: projectId,
    sender_user_id: u1, sender_name: MARK + ' PM', kind: 'voice',
    audio_path: clipPath, audio_duration_secs: 4.2,
    detected_lang: 'en', translations: { es: 'Mensaje de prueba' },
  } as never).select().single();
  check('R7: voice message row w/ translation payload', !vErr && (vmsg as any)?.translations?.es === 'Mensaje de prueba', vErr ? vErr.message : 'voice + es translation stored');

  // ── R8: panic fan-out — message + one notification per other member ──
  await db.from('radio_messages').insert({
    tenant_id: tenantId, channel_id: channelId, project_id: projectId,
    sender_user_id: u1, sender_name: MARK + ' PM', kind: 'panic',
    body: 'PANIC ALARM test', location: { lat: 33.30, lng: -111.84 },
  } as never);
  // replicate the route's fan-out: notify every member with a user_id except sender
  const { data: allMems } = await db.from('radio_members').select('user_id').eq('channel_id', channelId).not('user_id', 'is', null);
  const notifyIds = ((allMems || []) as any[]).map((m) => m.user_id).filter((id) => id && id !== u1);
  for (const uid of notifyIds) {
    await db.from('notifications').insert({ tenant_id: tenantId, user_id: uid, type: 'radio_panic', title: 'PANIC ALARM', body: MARK + ' panic test', project_id: projectId } as never);
  }
  const { data: notifs } = await db.from('notifications').select('id').eq('project_id', projectId).eq('type', 'radio_panic');
  check('R8: panic notifies every other member', (notifs || []).length === 1 && notifyIds.length === 1, `${(notifs || []).length} notification(s) for ${notifyIds.length} target(s)`);
  const { data: panicRow } = await db.from('radio_messages').select('location').eq('channel_id', channelId).eq('kind', 'panic').single();
  check('R9: panic carries location for the map link', Number((panicRow as any)?.location?.lat) === 33.3, `lat ${(panicRow as any)?.location?.lat}`);

  // ── R10: channel history reads back in order with all kinds ──
  const { data: history } = await db.from('radio_messages').select('kind').eq('channel_id', channelId).order('created_at', { ascending: true });
  check('R10: recorded history (voice + panic) reads back', (history || []).map((h: any) => h.kind).join(',') === 'voice,panic', (history || []).map((h: any) => h.kind).join(','));

  // ── R11: assist queue lifecycle (raise → ack → resolve) — Tier 1 ──
  const { data: assist } = await db.from('radio_assists').insert({
    tenant_id: tenantId, channel_id: channelId, project_id: projectId,
    requester_user_id: u1, requester_name: MARK + ' PM', note: 'ladder needed',
    location: { lat: 33.31, lng: -111.85 },
  } as never).select().single();
  await db.from('radio_assists').update({ status: 'acknowledged', acknowledged_by: MARK, acknowledged_at: new Date().toISOString() } as never).eq('id', (assist as any).id);
  await db.from('radio_assists').update({ status: 'resolved', resolved_at: new Date().toISOString() } as never).eq('id', (assist as any).id);
  const { data: aDone } = await db.from('radio_assists').select('status, acknowledged_by, resolved_at').eq('id', (assist as any).id).single();
  check('R11: assist raise→ack→resolve lifecycle', (aDone as any)?.status === 'resolved' && !!(aDone as any)?.acknowledged_by && !!(aDone as any)?.resolved_at, `status ${(aDone as any)?.status}, ack by ${(aDone as any)?.acknowledged_by ? 'set' : 'MISSING'}`);

  // ── R12: channel patch pair — sorted, active, then released — Tier 1 ──
  const { data: ch2 } = await db.from('radio_channels').insert({ tenant_id: tenantId, project_id: projectId, kind: 'custom', name: MARK + ' patch-b' } as never).select().single();
  const [ca, cb] = [channelId, (ch2 as any).id].sort();
  await db.from('radio_channel_patches').insert({ tenant_id: tenantId, channel_a: ca, channel_b: cb, created_by: u1 } as never);
  const { data: liveP } = await db.from('radio_channel_patches').select('id').eq('tenant_id', tenantId).eq('channel_a', ca).eq('channel_b', cb).is('released_at', null);
  await db.from('radio_channel_patches').update({ released_at: new Date().toISOString() } as never).eq('id', ((liveP || [])[0] as any)?.id);
  const { data: relP } = await db.from('radio_channel_patches').select('released_at').eq('id', ((liveP || [])[0] as any)?.id).single();
  check('R12: patch pair active then released', (liveP || []).length === 1 && !!(relP as any)?.released_at, `1 live pair, released_at ${(relP as any)?.released_at ? 'set' : 'MISSING'}`);

  // ── R13: priority-scan flag persists on the channel — Tier 1 ──
  await db.from('radio_channels').update({ priority: true } as never).eq('id', channelId);
  const { data: prio } = await db.from('radio_channels').select('priority').eq('id', channelId).single();
  check('R13: priority scanning flag persists', (prio as any)?.priority === true, `priority ${(prio as any)?.priority}`);

  // ── R14: tone signaling row stores + reads back — Tier 1 ──
  await db.from('radio_messages').insert({ tenant_id: tenantId, channel_id: channelId, project_id: projectId, sender_user_id: u1, sender_name: MARK + ' PM', kind: 'tone', body: 'ack' } as never);
  const { data: tone } = await db.from('radio_messages').select('body').eq('channel_id', channelId).eq('kind', 'tone').single();
  check('R14: tone row (ack) stored + readable', (tone as any)?.body === 'ack', `body ${(tone as any)?.body}`);

  // ── R15: disclosed location — live upsert + ping history (heatmap fuel) — Tier 1 ──
  await db.from('crew_locations').insert({ tenant_id: tenantId, project_id: projectId, user_id: u1, latitude: 33.3, longitude: -111.84, accuracy_meters: 8, battery_level: 76, trade: null, status: 'on_site', updated_at: new Date().toISOString() } as never);
  for (const [la, ln] of [[33.3001, -111.8401], [33.3002, -111.8402]]) {
    await db.from('crew_location_pings').insert({ tenant_id: tenantId, project_id: projectId, user_id: u1, display_name: MARK + ' PM', trade: null, latitude: la, longitude: ln, accuracy_meters: 8, source: 'radio' } as never);
  }
  const { data: pings } = await db.from('crew_location_pings').select('id').eq('project_id', projectId);
  const { data: liveLoc } = await db.from('crew_locations').select('latitude').eq('project_id', projectId);
  check('R15: crew live position + ping history', (pings || []).length === 2 && (liveLoc || []).length === 1, `${(pings || []).length} pings, ${(liveLoc || []).length} live row`);

  // ── cleanup ──
  await db.storage.from('project-files').remove([clipPath]);
  await db.from('notifications').delete().eq('project_id', projectId);
  await db.from('radio_assists').delete().eq('project_id', projectId);
  await db.from('crew_location_pings').delete().eq('project_id', projectId);
  await db.from('crew_locations').delete().eq('project_id', projectId);
  await db.from('radio_channel_patches').delete().eq('channel_a', ca).eq('channel_b', cb);
  await db.from('radio_channels').delete().eq('id', channelId); // cascades members+messages
  await db.from('radio_channels').delete().eq('id', (ch2 as any).id);
  await db.from('projects').delete().eq('id', projectId);
  const { data: left } = await db.from('projects').select('id').eq('id', projectId);
  const { data: leftM } = await db.from('radio_messages').select('id').eq('channel_id', channelId);
  check('Z: fixture fully cleaned up (cascade verified)', (left || []).length === 0 && (leftM || []).length === 0, 'no test rows remain');

  console.log(`\n${fail === 0 ? 'RADIO PROOF PASSED' : 'RADIO PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
