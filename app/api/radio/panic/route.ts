import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase-server';
import { createNotification } from '@/lib/notifications';

/**
 * Saguaro Radio — PANIC.
 * POST { channelId?, projectId?, location?: {lat,lng}, note? }
 * Drops a panic message on the channel (or the project All Hands), notifies
 * EVERY member with a high-visibility alert, emails the roster, and — when
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM are configured —
 * blasts SMS to every member with a phone on file. SMS is env-gated: wiring
 * is live the moment the keys land in the environment.
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'View');
  if (!g.ok) return g.res;
  const t = g.user.tenantId;
  try {
    const body = await req.json().catch(() => ({}));
    const db = createServerClient() as any;
    let channelId: string | null = body.channelId ?? null;
    let projectId: string | null = body.projectId ?? null;

    if (!channelId && projectId) {
      const { data: ch } = await db.from('radio_channels').select('id').eq('tenant_id', t).eq('project_id', projectId).eq('kind', 'project').limit(1);
      channelId = ((ch || [])[0] as any)?.id ?? null;
    }
    if (!channelId) return NextResponse.json({ error: 'channelId or projectId required' }, { status: 400 });
    const { data: chRow } = await db.from('radio_channels').select('project_id, name').eq('id', channelId).single();
    projectId = projectId ?? ((chRow as any)?.project_id ?? null);

    const loc = body.location && typeof body.location.lat === 'number' ? { lat: body.location.lat, lng: body.location.lng } : null;
    const who = g.user.email || 'Team member';
    const note = String(body.note || '').trim();
    const text = `PANIC ALARM from ${who}${note ? ` — ${note}` : ''}${loc ? ` — location ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : ''}`;

    const { data: msg, error } = await db.from('radio_messages').insert({
      tenant_id: t, channel_id: channelId, project_id: projectId,
      sender_user_id: g.user.id, sender_name: who, kind: 'panic', body: text, location: loc,
    } as never).select().single();
    if (error) throw error;

    const { data: members } = await db.from('radio_members').select('user_id, display_name').eq('channel_id', channelId);
    const userIds = ((members || []) as any[]).map((m) => m.user_id).filter(Boolean).filter((id) => id !== g.user.id);

    // 1) In-app + push, to every member.
    await Promise.all(userIds.map((uid) => createNotification(
      t, uid, 'radio_panic', 'PANIC ALARM', text, `/app/radio?channel=${channelId}`, projectId ?? undefined
    )));

    // 2) Email blast (Resend — configured).
    try {
      const key = process.env.RESEND_API_KEY;
      if (key && userIds.length) {
        const { data: users } = await db.from('users').select('id, email').in('id', userIds);
        const emails = ((users || []) as any[]).map((u) => u.email).filter(Boolean);
        if (emails.length) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || 'Saguaro Radio <noreply@mail.saguarocrm.com>',
              to: emails.slice(0, 50),
              subject: `PANIC ALARM — ${(chRow as any)?.name || 'Radio'}`,
              text: `${text}\n\n${loc ? `Map: https://maps.google.com/?q=${loc.lat},${loc.lng}\n\n` : ''}Open Saguaro Radio to respond.`,
            }),
          });
        }
      }
    } catch { /* email is best-effort */ }

    // 3) SMS blast — env-gated Twilio REST (no SDK needed).
    let smsSent = 0;
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
      if (sid && tok && from && userIds.length) {
        const { data: users } = await db.from('users').select('id, phone').in('id', userIds);
        const phones = ((users || []) as any[]).map((u) => u.phone).filter(Boolean).slice(0, 25);
        const auth = Buffer.from(`${sid}:${tok}`).toString('base64');
        for (const to of phones) {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ From: from, To: String(to), Body: text.slice(0, 300) }),
          });
          if (r.ok) smsSent++;
        }
      }
    } catch { /* SMS is best-effort */ }

    return NextResponse.json({ message: msg, notified: userIds.length, smsSent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
