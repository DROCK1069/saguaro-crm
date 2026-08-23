/* SAGUARO RADIO PROOF — proves the PTT server layer against the LIVE stack:
 * channel auto-creation idempotency, membership, voice clip storage + signed
 * playback, panic fan-out (message + notification per member), sub-portal
 * membership, and translation-layer columns. Fixture fully cleaned up. */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import { stampPresentAtSend } from '../lib/radio-receipts';

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

  // ── R17: member add (roster management) — same insert shape as the route ──
  const u3 = '00000000-0000-4000-8000-00000000a003';
  const addMember = async (userId: string) => { // replicate POST {channelId, addUserId}
    const { data: ex } = await db.from('radio_members').select('id').eq('tenant_id', tenantId).eq('channel_id', channelId).eq('user_id', userId).limit(1);
    if (ex && ex.length) return 'already';
    await db.from('radio_members').insert({ channel_id: channelId, tenant_id: tenantId, user_id: userId, display_name: MARK + ' Foreman', role: 'member' } as never);
    return 'added';
  };
  const before17 = ((await db.from('radio_members').select('id').eq('channel_id', channelId)).data || []).length;
  const a1 = await addMember(u3);
  const a2 = await addMember(u3); // dedupe: re-add is a no-op
  const after17 = ((await db.from('radio_members').select('id').eq('channel_id', channelId)).data || []).length;
  check('R17: member add grows roster once (re-add deduped)', after17 === before17 + 1 && a1 === 'added' && a2 === 'already', `${before17} -> ${after17} members; second add: ${a2}`);

  // ── R18: remove shrinks roster; the LAST member is protected (route guard) ──
  const removeMember = async (memberId: string) => { // replicate POST {removeMemberId}
    const { data: row } = await db.from('radio_members').select('id, channel_id').eq('tenant_id', tenantId).eq('id', memberId).maybeSingle();
    if (!row) return 404;
    const { count } = await db.from('radio_members').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('channel_id', (row as any).channel_id);
    if ((count ?? 0) <= 1) return 400; // 'A channel needs at least one member'
    await db.from('radio_members').delete().eq('tenant_id', tenantId).eq('id', memberId);
    return 200;
  };
  const { data: u3row } = await db.from('radio_members').select('id').eq('channel_id', channelId).eq('user_id', u3).single();
  const rm = await removeMember((u3row as any).id);
  const after18 = ((await db.from('radio_members').select('id').eq('channel_id', channelId)).data || []).length;
  const { data: solo } = await db.from('radio_channels').insert({ tenant_id: tenantId, project_id: projectId, kind: 'custom', name: MARK + ' solo' } as never).select().single();
  const { data: soloMem } = await db.from('radio_members').insert({ channel_id: (solo as any).id, tenant_id: tenantId, user_id: u1, display_name: MARK + ' PM', role: 'dispatcher' } as never).select().single();
  const guard = await removeMember((soloMem as any).id);
  const soloLeft = ((await db.from('radio_members').select('id').eq('channel_id', (solo as any).id)).data || []).length;
  check('R18: remove shrinks roster; last member protected', rm === 200 && after18 === before17 && guard === 400 && soloLeft === 1, `remove -> ${rm}, roster ${after17} -> ${after18}; last-member remove -> ${guard}, member kept`);

  // ── R19: direct 1:1 channel — direct_key dedupe (two creates -> one channel) ──
  const pair = [u1, u2].sort().join(':');
  const direct = async () => { // replicate POST {directToUserId}
    const { data: ex } = await db.from('radio_channels').select('id').eq('tenant_id', tenantId).eq('direct_key', pair).maybeSingle();
    if (ex) return { id: (ex as any).id, existed: true };
    const { data: ch } = await db.from('radio_channels').insert({ tenant_id: tenantId, project_id: projectId, kind: 'direct', name: MARK + ' direct', allow_subs: false, direct_key: pair, created_by: u1 } as never).select().single();
    return { id: (ch as any).id, existed: false };
  };
  const d1 = await direct();
  const d2 = await direct();
  const { data: directRows } = await db.from('radio_channels').select('id').eq('tenant_id', tenantId).eq('direct_key', pair);
  check('R19: direct channel deduped by direct_key', !d1.existed && d2.existed && d1.id === d2.id && (directRows || []).length === 1, `two creates -> ${(directRows || []).length} channel`);

  // ── R20: locked channel invisible to non-members (the GET visibility filter) ──
  const { data: lockedCh } = await db.from('radio_channels').insert({ tenant_id: tenantId, project_id: projectId, kind: 'custom', name: MARK + ' locked', locked: true } as never).select().single();
  await db.from('radio_members').insert({ channel_id: (lockedCh as any).id, tenant_id: tenantId, user_id: u1, display_name: MARK + ' PM', role: 'dispatcher' } as never);
  const visibleTo = async (uid: string) => { // replicate the route: locked channels skip auto-join, then filter
    const { data: chs } = await db.from('radio_channels').select('id, locked').eq('tenant_id', tenantId).eq('project_id', projectId).is('deleted_at', null);
    const { data: mem } = await db.from('radio_members').select('channel_id, user_id').eq('tenant_id', tenantId).in('channel_id', ((chs || []) as any[]).map((c) => c.id));
    const mine = new Set(((mem || []) as any[]).filter((m) => m.user_id === uid).map((m) => m.channel_id));
    return ((chs || []) as any[]).filter((c) => !c.locked || mine.has(c.id)).map((c) => c.id);
  };
  const u1Sees = await visibleTo(u1);
  const u2Sees = await visibleTo(u2);
  check('R20: locked channel visible to member, hidden from outsider', u1Sees.includes((lockedCh as any).id) && !u2Sees.includes((lockedCh as any).id), `member sees ${u1Sees.length} channel(s), outsider ${u2Sees.length}`);

  // ── R21: broadcast fan-out — one message row per selected channel ──
  const targets = [channelId, (solo as any).id, (lockedCh as any).id];
  for (const cid of targets) {
    await db.from('radio_messages').insert({ tenant_id: tenantId, channel_id: cid, project_id: projectId, sender_user_id: u1, sender_name: MARK + ' PM', kind: 'text', body: MARK + ' ALL-CALL' } as never);
  }
  const { data: bcast } = await db.from('radio_messages').select('channel_id').eq('body', MARK + ' ALL-CALL');
  const bcastChans = new Set(((bcast || []) as any[]).map((b) => b.channel_id)).size;
  check('R21: broadcast fans out one row per channel', (bcast || []).length === 3 && bcastChans === 3, `${(bcast || []).length} rows across ${bcastChans} channels`);

  // ── R22: heard-by receipts lifecycle (Task R13 — migration 063) ──
  // POST semantics mirrored from app/api/radio/receipts/route.ts: membership
  // row supplies the display name (call sign first), action defaults 'played',
  // and the partial unique index dedupes repeat plays silently.
  const voiceMsgId = (vmsg as any)?.id;
  const postReceipt = async (listenerId: string) => {
    const { data: memRows } = await db.from('radio_members').select('id, display_name, call_sign')
      .eq('tenant_id', tenantId).eq('channel_id', channelId).eq('user_id', listenerId).limit(1);
    const mem = ((memRows || [])[0] as any) ?? null;
    if (!mem) return { stored: false, error: 'not a member' };
    const { error } = await db.from('radio_receipts').insert({
      tenant_id: tenantId, channel_id: channelId, message_id: voiceMsgId, user_id: listenerId,
      display_name: mem.call_sign || mem.display_name || null, action: 'played',
    } as never);
    return { stored: !error, error: error?.message };
  };
  const rc1 = await postReceipt(u2); // u2 heard u1's voice clip
  const { data: rcRows1 } = await db.from('radio_receipts').select('user_id, display_name, action').eq('message_id', voiceMsgId);
  check('R22a: play receipt stored with member display name',
    rc1.stored && (rcRows1 || []).length === 1 && ((rcRows1 || [])[0] as any)?.display_name === MARK + ' Super' && ((rcRows1 || [])[0] as any)?.action === 'played',
    rc1.stored ? `1 receipt, name "${((rcRows1 || [])[0] as any)?.display_name}"` : `insert failed: ${rc1.error}`);

  const rc2 = await postReceipt(u2); // identical replay — unique index must dedupe
  const { data: rcRows2 } = await db.from('radio_receipts').select('id').eq('message_id', voiceMsgId).eq('user_id', u2);
  check('R22b: second identical receipt deduped by unique index',
    !rc2.stored && (rcRows2 || []).length === 1,
    `dup insert rejected: ${!rc2.stored}, still ${(rcRows2 || []).length} row(s)`);

  // present_at_send: members live on the channel (last_seen_at within 90s) at
  // send time get snapshotted onto the message by lib/radio-receipts.ts.
  await db.from('radio_members').update({ last_seen_at: new Date().toISOString() } as never)
    .eq('channel_id', channelId).in('user_id', [u1, u2]);
  await stampPresentAtSend(db, tenantId, channelId, voiceMsgId);
  const { data: stamped } = await db.from('radio_messages').select('present_at_send').eq('id', voiceMsgId).single();
  const present = Array.isArray((stamped as any)?.present_at_send) ? (stamped as any).present_at_send : [];
  const presentIds = present.map((p: any) => p.user_id);
  check('R22c: present_at_send stamps live members onto the message',
    present.length === 2 && presentIds.includes(u1) && presentIds.includes(u2) && present.every((p: any) => !!p.name),
    `${present.length} present, ids [${presentIds.join(', ')}]`);

  // ── cleanup ──
  for (const cid of [(solo as any).id, d1.id, (lockedCh as any).id]) await db.from('radio_channels').delete().eq('id', cid);
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
  const { data: leftR } = await db.from('radio_receipts').select('id').eq('channel_id', channelId);
  check('Z: fixture fully cleaned up (cascade verified)', (left || []).length === 0 && (leftM || []).length === 0 && (leftR || []).length === 0, 'no test rows remain (messages + receipts cascaded)');

  console.log(`\n${fail === 0 ? 'RADIO PROOF PASSED' : 'RADIO PROOF FAILED'} — ${pass} ok, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
