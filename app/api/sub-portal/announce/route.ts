import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sub-portal/announce
 * Body: { subject, body, sentTo, ...announcement }
 * Emails an announcement to the selected sub portal users in the tenant.
 * `sentTo` is either ['all'] (every sub) or a list of trade names (best-effort filter).
 * No announcements table exists, so this just sends the emails.
 * Returns { success, sent }.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const subject: string = (payload?.subject || '').trim();
    const messageBody: string = (payload?.body || '').trim();
    const sentTo: string[] = Array.isArray(payload?.sentTo) ? payload.sentTo : ['all'];

    if (!subject || !messageBody) {
      return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
    }

    const db = createServerClient();

    // All sub portal users in this tenant.
    const { data: subs } = await db
      .from('portal_users')
      .select('email, name, company, role')
      .eq('tenant_id', user.tenantId)
      .eq('portal_type', 'sub');

    const all = (subs || []) as Array<Record<string, any>>;

    // Best-effort trade filter: if specific trades selected, match against role;
    // fall back to all subs so an announcement is never silently dropped.
    const allTrades = sentTo.includes('all') || sentTo.length === 0;
    let recipients = all;
    if (!allTrades) {
      const wanted = sentTo.map((t) => String(t).toLowerCase());
      const filtered = all.filter((u) =>
        wanted.some((w) => String(u.role || '').toLowerCase().includes(w))
      );
      recipients = filtered.length > 0 ? filtered : all;
    }

    const emails = Array.from(
      new Set(recipients.map((u) => u.email).filter((e): e is string => !!e))
    );

    if (emails.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:15px;line-height:1.6;">
      <h2 style="color:#0D1116;font-size:20px;margin:0 0 16px;">${subject}</h2>
      <p style="white-space:pre-wrap;margin:0;">${messageBody}</p>
    </div>`;

    let sent = 0;
    for (const to of emails) {
      try {
        await sendEmail({ to, subject: `Announcement: ${subject}`, html });
        sent++;
      } catch (e) {
        console.error('[sub-portal/announce] send failed for', to, e);
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error('[sub-portal/announce]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
