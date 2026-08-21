import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { signUrl } from '@/lib/storage-signing';

const BUCKET = 'project-files';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /\.(m4a|mp4|aac|mp3|wav|webm|ogg|caf)$/i;

/**
 * Saguaro Radio — SUB PORTAL access (approved scope: subs join project
 * channels). Token-authenticated; scoped to the sub's project's sub-enabled
 * channels only. GET lists traffic (signed audio); POST sends text or voice.
 */
async function auth(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-portal-token');
  if (!token) return null;
  const db = createServerClient() as any;
  const { data: session } = await db.from('portal_sub_sessions').select('*').eq('token', token).eq('status', 'active').single();
  return session ? { db, session: session as any } : null;
}

async function subChannel(db: any, session: any) {
  const { data } = await db.from('radio_channels')
    .select('id, name, project_id')
    .eq('tenant_id', session.tenant_id)
    .eq('project_id', session.project_id)
    .eq('allow_subs', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  return ((data || [])[0] as any) ?? null;
}

async function ensureMember(db: any, session: any, channelId: string) {
  const { data } = await db.from('radio_members').select('id').eq('channel_id', channelId).eq('portal_sub_id', session.sub_id).limit(1);
  if (!data || !data.length) {
    await db.from('radio_members').insert({
      channel_id: channelId, tenant_id: session.tenant_id, portal_sub_id: session.sub_id,
      display_name: session.sub_company || 'Subcontractor',
    } as never);
  }
}

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if (!a) return NextResponse.json({ error: 'Invalid or expired portal token' }, { status: 401 });
  try {
    const ch = await subChannel(a.db, a.session);
    if (!ch) return NextResponse.json({ channel: null, messages: [] });
    await ensureMember(a.db, a.session, ch.id);
    const after = req.nextUrl.searchParams.get('after');
    let q = a.db.from('radio_messages').select('*').eq('channel_id', ch.id);
    if (after) q = q.gt('created_at', after);
    const { data } = await q.order('created_at', { ascending: after ? true : false }).limit(100);
    const rows = ((data || []) as any[]);
    const messages = await Promise.all((after ? rows : rows.reverse()).map(async (m) => ({
      ...m,
      audio_url: m.audio_path ? await signUrl(m.audio_path, 3600) : null,
      image_url: m.image_path ? await signUrl(m.image_path, 3600) : null,
    })));
    return NextResponse.json({ channel: { id: ch.id, name: ch.name }, messages });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if (!a) return NextResponse.json({ error: 'Invalid or expired portal token' }, { status: 401 });
  try {
    const ch = await subChannel(a.db, a.session);
    if (!ch) return NextResponse.json({ error: 'Radio not enabled for this project' }, { status: 404 });
    await ensureMember(a.db, a.session, ch.id);
    const sender = a.session.sub_company || 'Subcontractor';
    const ct = req.headers.get('content-type') || '';

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      const durationSecs = Number(form.get('durationSecs')) || null;
      if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
      const safeName = String(file.name || 'clip.m4a').replace(/[^\w.\-]+/g, '_');
      if (!ALLOWED.test(safeName)) return NextResponse.json({ error: 'Unsupported audio type' }, { status: 415 });
      const path = `${a.session.tenant_id}/radio/${ch.id}/${Date.now()}_sub_${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await a.db.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || 'audio/mp4', upsert: false });
      if (upErr) throw upErr;
      const { data: msg, error } = await a.db.from('radio_messages').insert({
        tenant_id: a.session.tenant_id, channel_id: ch.id, project_id: ch.project_id,
        sender_portal_sub_id: a.session.sub_id, sender_name: sender,
        kind: 'voice', audio_path: path, audio_duration_secs: durationSecs,
      } as never).select().single();
      if (error) throw error;
      return NextResponse.json({ message: msg }, { status: 201 });
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body.body || '').trim();
    if (!text) return NextResponse.json({ error: 'body required' }, { status: 400 });
    const { data: msg, error } = await a.db.from('radio_messages').insert({
      tenant_id: a.session.tenant_id, channel_id: ch.id, project_id: ch.project_id,
      sender_portal_sub_id: a.session.sub_id, sender_name: sender, kind: 'text', body: text,
    } as never).select().single();
    if (error) throw error;
    return NextResponse.json({ message: msg }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
