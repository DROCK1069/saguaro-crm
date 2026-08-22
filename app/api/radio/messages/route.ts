import { NextRequest, NextResponse } from 'next/server';
import { hasEntitlement, upsell } from '@/lib/entitlements';
import { requirePermission } from '@/lib/permissions';
import { signStoredUrl } from '@/lib/storage-signing';
import { createNotification } from '@/lib/notifications';
import { translateRadioMessage } from '@/lib/translate';

/**
 * Saguaro Radio — channel traffic.
 * GET ?channelId=&after=  — messages (newest 100, or everything after a cursor
 *   timestamp for near-real-time polling); voice/image paths come back signed.
 * POST { channelId, kind: 'text'|'alert', body } — send text; 'alert' is the
 *   high-visibility broadcast (notifies every member, bypassing quiet UX).
 */
async function membership(db: any, t: string, uid: string, channelId: string) {
  const { data } = await db.from('radio_members').select('id, role').eq('tenant_id', t).eq('channel_id', channelId).eq('user_id', uid).limit(1);
  return (data || [])[0] ?? null;
}

export async function GET(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const db = g.db as any, t = g.user.tenantId;
  if (!(await hasEntitlement(db, t, 'radio'))) return NextResponse.json(upsell('radio'), { status: 403 });
  try {
    const channelId = req.nextUrl.searchParams.get('channelId');
    const after = req.nextUrl.searchParams.get('after');
    if (!channelId) return NextResponse.json({ error: 'channelId required' }, { status: 400 });
    if (!(await membership(db, t, g.user.id, channelId))) return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });

    // Presence + read piggyback: polling IS being on channel. Fire-and-forget —
    // never blocks or fails the read.
    const nowIso = new Date().toISOString();
    void db.from('radio_members').update({ last_seen_at: nowIso, last_read_at: nowIso } as never)
      .eq('tenant_id', t).eq('channel_id', channelId).eq('user_id', g.user.id)
      .then(() => {}, () => {});

    let q = db.from('radio_messages').select('*').eq('tenant_id', t).eq('channel_id', channelId);
    if (after) q = q.gt('created_at', after);
    const { data, error } = await q.order('created_at', { ascending: after ? true : false }).limit(100);
    if (error) throw error;
    const rows = (data || []) as any[];
    const messages = await Promise.all((after ? rows : rows.reverse()).map(async (m) => ({
      ...m,
      audio_url: m.audio_path ? await signStoredUrl('project-files', m.audio_path, 3600) : null,
      image_url: m.image_path ? await signStoredUrl('project-files', m.image_path, 3600) : null,
    })));
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const db = g.db as any, t = g.user.tenantId;
  if (!(await hasEntitlement(db, t, 'radio'))) return NextResponse.json(upsell('radio'), { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const channelId = body.channelId;
    const kind = body.kind === 'alert' ? 'alert' : 'text';
    const text = String(body.body || '').trim();
    if (!channelId || !text) return NextResponse.json({ error: 'channelId and body required' }, { status: 400 });
    if (!(await membership(db, t, g.user.id, channelId))) return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 });

    const { data: ch } = await db.from('radio_channels').select('project_id, name').eq('id', channelId).single();
    const { data: msg, error } = await db.from('radio_messages').insert({
      tenant_id: t, channel_id: channelId, project_id: (ch as any)?.project_id ?? null,
      sender_user_id: g.user.id, sender_name: g.user.email || 'Team member', kind, body: text,
    } as never).select().single();
    if (error) throw error;

    // Translation brain: fire-and-forget (env-gated inside; never blocks the send).
    void translateRadioMessage(db, (msg as any)?.id, text);

    if (kind === 'alert') {
      const { data: members } = await db.from('radio_members').select('user_id').eq('channel_id', channelId).not('user_id', 'is', null);
      await Promise.all(((members || []) as any[])
        .filter((m) => m.user_id && m.user_id !== g.user.id)
        .map((m) => createNotification(t, m.user_id, 'radio_alert', `ALERT — ${(ch as any)?.name || 'Radio'}`, text, `/app/radio?channel=${channelId}`, (ch as any)?.project_id ?? undefined)));
    }
    return NextResponse.json({ message: msg }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
