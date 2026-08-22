import { NextRequest, NextResponse } from 'next/server';
import { hasEntitlement, upsell } from '@/lib/entitlements';
import { requirePermission } from '@/lib/permissions';

/**
 * Saguaro Radio — talkgroups.
 * GET ?projectId= — list the caller's channels (org-wide + this project's).
 *   Auto-creates the project's "All Hands" talkgroup on first touch (subs
 *   allowed — approved scope) and auto-joins the caller.
 * POST { name, projectId?, allowSubs? } — create a custom talkgroup.
 */
export async function GET(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const db = g.db as any, t = g.user.tenantId, uid = g.user.id;
  if (!(await hasEntitlement(db, t, 'radio'))) return NextResponse.json(upsell('radio'), { status: 403 });
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');

    if (projectId) {
      // Ensure the project talkgroup exists (idempotent via unique constraint).
      const { data: existing } = await db.from('radio_channels').select('id').eq('tenant_id', t).eq('project_id', projectId).eq('kind', 'project').limit(1);
      if (!existing || existing.length === 0) {
        await db.from('radio_channels').insert({ tenant_id: t, project_id: projectId, kind: 'project', name: 'All Hands', allow_subs: true, created_by: uid } as never);
      }
    }

    let q = db.from('radio_channels').select('id, project_id, name, kind, allow_subs, created_at').eq('tenant_id', t).is('deleted_at', null);
    if (projectId) q = q.or(`project_id.eq.${projectId},project_id.is.null`);
    const { data: channels, error } = await q.order('created_at', { ascending: true });
    if (error) throw error;
    const list = (channels || []) as any[];

    // ONE members query across every listed channel: caller auto-join,
    // per-channel headcount, and live presence (last_seen_at within 90s)
    // all come out of the same rows.
    const ids = list.map((c) => c.id);
    let allMembers: any[] = [];
    if (ids.length) {
      const { data: mem } = await db.from('radio_members').select('channel_id, user_id, monitoring, role, last_seen_at, last_read_at').eq('tenant_id', t).in('channel_id', ids);
      allMembers = (mem || []) as any[];
      const joined = new Set(allMembers.filter((m) => m.user_id === uid).map((m) => m.channel_id));
      const toJoin = ids.filter((id) => !joined.has(id));
      if (toJoin.length) {
        await db.from('radio_members').insert(toJoin.map((channel_id) => ({ channel_id, tenant_id: t, user_id: uid, display_name: g.user.email || null })) as never);
        for (const id of toJoin) allMembers.push({ channel_id: id, user_id: uid, monitoring: true, role: 'member', last_seen_at: null, last_read_at: null });
      }
    }
    const memMap = new Map(allMembers.filter((m) => m.user_id === uid).map((m) => [m.channel_id, m]));
    const ONLINE_WINDOW_MS = 90 * 1000;
    const nowMs = Date.now();

    // Last message + unread count per channel (small N — fine per channel).
    const enriched = await Promise.all(list.map(async (c) => {
      const mine = memMap.get(c.id) as any;
      let unreadQ = db.from('radio_messages').select('id', { count: 'exact', head: true }).eq('channel_id', c.id);
      if (mine?.last_read_at) unreadQ = unreadQ.gt('created_at', mine.last_read_at);
      const [{ data: last }, { count: unread }] = await Promise.all([
        db.from('radio_messages').select('kind, body, sender_name, created_at, audio_duration_secs').eq('channel_id', c.id).order('created_at', { ascending: false }).limit(1),
        unreadQ,
      ]);
      const chMembers = allMembers.filter((m) => m.channel_id === c.id);
      const onChannel = chMembers.filter((m) => m.last_seen_at && nowMs - new Date(m.last_seen_at).getTime() <= ONLINE_WINDOW_MS).length;
      const lm = (last || [])[0] as any;
      return {
        ...c,
        members: chMembers.length,
        onChannel,
        unread: Math.min(unread ?? 0, 99),
        monitoring: mine?.monitoring ?? true,
        lastMessage: lm ? { kind: lm.kind, body: lm.body, sender: lm.sender_name, at: lm.created_at, secs: lm.audio_duration_secs } : null,
      };
    }));

    return NextResponse.json({ channels: enriched });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const db = g.db as any, t = g.user.tenantId;
  if (!(await hasEntitlement(db, t, 'radio'))) return NextResponse.json(upsell('radio'), { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const { data, error } = await db.from('radio_channels').insert({
      tenant_id: t, project_id: body.projectId ?? null, kind: 'custom', name,
      allow_subs: body.allowSubs === true, created_by: g.user.id,
    } as never).select().single();
    if (error) throw error;
    await db.from('radio_members').insert({ channel_id: (data as any).id, tenant_id: t, user_id: g.user.id, display_name: g.user.email || null, role: 'dispatcher' } as never);
    return NextResponse.json({ channel: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
