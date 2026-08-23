import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';

/**
 * Saguaro Radio — heard-by receipts (Task R13).
 *
 * POST { messageIds: string[] } (or { messageId }) — record that the caller
 *   played those transmissions. Membership-checked per channel, own messages
 *   skipped, deduped by the partial unique indexes (insert errors ignored).
 * GET ?messageId= — one message's receipt detail for the sender's "heard by"
 *   sheet: { receipts: [{ user_id, portal_sub_id, display_name, created_at }],
 *   present: [...] } where `present` is the message's present_at_send snapshot.
 *
 * TOLERANT BY DESIGN: the radio_receipts table + present_at_send column ship
 * in migration 063. Until that's applied, every branch here degrades to an
 * empty 200 — the radio keeps working, the receipts UI just stays quiet.
 * Receipts are garnish on the transmission, never a failure mode for it.
 */

async function membership(db: any, t: string, uid: string, channelId: string) {
  const { data } = await db.from('radio_members').select('id, display_name, call_sign').eq('tenant_id', t).eq('channel_id', channelId).eq('user_id', uid).limit(1);
  return (data || [])[0] ?? null;
}

export async function GET(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const db = g.db as any, t = g.user.tenantId;
  try {
    const messageId = req.nextUrl.searchParams.get('messageId');
    if (!messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });
    const { data: msg } = await db.from('radio_messages').select('id, tenant_id, channel_id, present_at_send').eq('id', messageId).maybeSingle();
    if (!msg || (msg as any).tenant_id !== t) return NextResponse.json({ receipts: [], present: [] });
    if (!(await membership(db, t, g.user.id, (msg as any).channel_id))) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });
    }
    let receipts: any[] = [];
    try {
      const { data } = await db.from('radio_receipts')
        .select('user_id, portal_sub_id, display_name, action, created_at')
        .eq('tenant_id', t).eq('message_id', messageId)
        .order('created_at', { ascending: true }).limit(100);
      receipts = (data || []) as any[];
    } catch { /* table not migrated yet — ship empty */ }
    const present = Array.isArray((msg as any).present_at_send) ? (msg as any).present_at_send : [];
    return NextResponse.json({ receipts, present });
  } catch {
    // Never a hard failure for garnish — the app treats empty as "no data yet".
    return NextResponse.json({ receipts: [], present: [] });
  }
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const db = g.db as any, t = g.user.tenantId, uid = g.user.id;
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = [...new Set(
      (Array.isArray(body.messageIds) ? body.messageIds : body.messageId ? [body.messageId] : [])
        .filter((x: unknown) => typeof x === 'string' && x.length > 0 && !String(x).startsWith('local-'))
        .slice(0, 25),
    )] as string[];
    if (ids.length === 0) return NextResponse.json({ ok: true, stored: 0 });

    const { data: msgs } = await db.from('radio_messages')
      .select('id, tenant_id, channel_id, sender_user_id')
      .in('id', ids);
    const rows = ((msgs || []) as any[]).filter((m) => m.tenant_id === t && m.sender_user_id !== uid);
    if (rows.length === 0) return NextResponse.json({ ok: true, stored: 0 });

    // One membership check per distinct channel; the member row also supplies
    // the display name (call sign first — that's the radio identity).
    const memCache = new Map<string, any>();
    let stored = 0;
    for (const m of rows) {
      let mem = memCache.get(m.channel_id);
      if (mem === undefined) {
        mem = await membership(db, t, uid, m.channel_id);
        memCache.set(m.channel_id, mem);
      }
      if (!mem) continue;
      try {
        const { error } = await db.from('radio_receipts').insert({
          tenant_id: t, channel_id: m.channel_id, message_id: m.id, user_id: uid,
          display_name: mem.call_sign || mem.display_name || g.user.email || null,
          action: body.action === 'seen' ? 'seen' : 'played',
        } as never);
        if (!error) stored += 1;
        // error = duplicate (unique index) or table missing — both fine to ignore.
      } catch { /* tolerant: receipts never fail the caller */ }
    }
    return NextResponse.json({ ok: true, stored });
  } catch {
    return NextResponse.json({ ok: true, stored: 0 });
  }
}
