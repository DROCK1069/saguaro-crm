import { NextRequest, NextResponse } from 'next/server';
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

    // Auto-join the caller to any listed channel they're not in yet.
    const ids = list.map((c) => c.id);
    let memberships: any[] = [];
    if (ids.length) {
      const { data: mem } = await db.from('radio_members').select('channel_id, monitoring, role').eq('tenant_id', t).eq('user_id', uid).in('channel_id', ids);
      memberships = (mem || []) as any[];
      const joined = new Set(memberships.map((m) => m.channel_id));
      const toJoin = ids.filter((id) => !joined.has(id));
      if (toJoin.length) {
        await db.from('radio_members').insert(toJoin.map((channel_id) => ({ channel_id, tenant_id: t, user_id: uid, display_name: g.user.email || null })) as never);
        for (const id of toJoin) memberships.push({ channel_id: id, monitoring: true, role: 'member' });
      }
    }
    const memMap = new Map(memberships.map((m) => [m.channel_id, m]));

    // Last message + member count per channel (small N — fine per channel).
    const enriched = await Promise.all(list.map(async (c) => {
      const [{ data: last }, { count }] = await Promise.all([
        db.from('radio_messages').select('kind, body, sender_name, created_at, audio_duration_secs').eq('channel_id', c.id).order('created_at', { ascending: false }).limit(1),
        db.from('radio_members').select('id', { count: 'exact', head: true }).eq('channel_id', c.id),
      ]);
      const lm = (last || [])[0] as any;
      return {
        ...c,
        members: count ?? 0,
        monitoring: (memMap.get(c.id) as any)?.monitoring ?? true,
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
