import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Documents', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;

  try {
    const formData = await req.formData();
    const upload = (formData.get('file') ?? formData.get('image') ?? formData.get('photo')) as File | null;
    const projectId = (formData.get('projectId') as string) || '';
    const category  = (formData.get('category')  as string) || 'Progress';
    const caption   = (formData.get('caption')   as string) || '';
    const filename  = upload?.name || `photo-${Date.now()}.jpg`;

    // Optional GPS, posted as a 'lat,lng' string.
    let locationLat: number | null = null;
    let locationLng: number | null = null;
    const location = (formData.get('location') as string) || '';
    if (location) {
      const [latStr, lngStr] = location.split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        locationLat = lat;
        locationLng = lng;
      }
    }

    if (!upload) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Service-role client for BOTH storage and DB — bypasses RLS (the old code used the
    // anon client for the insert, which RLS rejected -> 500 -> photo silently lost).
    const db = createServerClient();

    const buffer = Buffer.from(await upload.arrayBuffer());
    const storagePath = `projects/${projectId}/photos/${Date.now()}-${filename}`;

    const { data: uploadData, error: uploadError } = await db.storage
      .from('project-files')
      .upload(storagePath, buffer, { contentType: upload.type || 'image/jpeg' });

    if (uploadError || !uploadData) {
      console.error('[photos/upload] storage error:', uploadError?.message);
      return NextResponse.json({ error: uploadError?.message || 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = db.storage
      .from('project-files')
      .getPublicUrl(storagePath);

    const url = urlData?.publicUrl || null;
    if (!url) {
      return NextResponse.json({ error: 'Failed to resolve public URL' }, { status: 500 });
    }

    // Persist a row into `photos` — the canonical table that holds every existing photo and that
    // photos/list reads (then signs the url for the private project-files bucket). The bug was NOT
    // the table/columns (this was always right) — it was that prod ran an OLD build that did this
    // insert with the anon client, which RLS rejected (500) so the row was lost. createServerClient
    // is service-role and bypasses RLS. `url` is stored in public-URL form; signUrl() converts it
    // to a short-lived signed URL on read.
    const nowIso = new Date().toISOString();
    const { data: photo, error: insertError } = await db
      .from('photos')
      .insert({
        tenant_id: user.tenantId,
        project_id: projectId,
        url,
        filename,
        category,
        caption,
        taken_by: user.email || '',
        taken_at: nowIso,
        file_size: upload.size,
        mime_type: upload.type || 'image/jpeg',
        location_lat: locationLat,
        location_lng: locationLng,
      } as never)
      .select()
      .single();

    if (insertError || !photo) {
      console.error('[photos/upload] insert error:', insertError?.message);
      return NextResponse.json({ error: insertError?.message || 'Failed to save photo' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      photo,
    });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[photos/upload] error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
