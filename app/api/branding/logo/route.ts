import { NextRequest, NextResponse } from 'next/server';
import { getUser, createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const ALLOWED = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
const MAX_BYTES = 5 * 1024 * 1024;

/** POST /api/branding/logo — multipart upload of the tenant logo to the public
 *  `branding` bucket (tenant-prefixed), persists the URL to tenants.settings. */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Logo must be under 5 MB' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ALLOWED.includes(ext)) return NextResponse.json({ error: 'Use PNG, JPG, WEBP, or SVG' }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = createServerClient();
  const path = `${user.tenantId}/logo_${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage
    .from('branding')
    .upload(path, bytes, { contentType: file.type || `image/${ext}`, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Public bucket → permanent URL (logos are public by nature; they go on PDFs,
  // portals, and emails sent to owners/subs).
  const { data: pub } = db.storage.from('branding').getPublicUrl(path);
  const logo_url = pub.publicUrl;

  // Merge into tenants.settings so the WhiteLabelProvider + reports pick it up.
  const { data: existing } = await db.from('tenants').select('settings').eq('id', user.tenantId).single();
  const settings = { ...((existing as any)?.settings ?? {}), logo_url };
  const { error: updErr } = await db
    .from('tenants')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', user.tenantId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, logo_url });
}
