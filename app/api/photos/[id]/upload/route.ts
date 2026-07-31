import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '@/lib/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requirePermission(req, 'Documents', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;

  try {
    const formData = await req.formData();
    const upload = (formData.get('file') ?? formData.get('image') ?? formData.get('photo')) as File | null;

    if (!upload) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const db = createServerClient();

    // Confirm the photo exists and belongs to this tenant before overwriting its URL.
    const { data: existing, error: lookupError } = await db
      .from('photos')
      .select('id, project_id')
      .eq('id', id)
      .eq('tenant_id', user.tenantId)
      .single();

    if (lookupError || !existing) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const filename = upload.name || `photo-${Date.now()}.jpg`;
    const buffer = Buffer.from(await upload.arrayBuffer());
    const storagePath = `projects/${existing.project_id || 'unassigned'}/photos/${Date.now()}-${filename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, buffer, { contentType: upload.type || 'image/jpeg' });

    if (uploadError || !uploadData) {
      console.error('[photos/[id]/upload] storage error:', uploadError?.message);
      return NextResponse.json({ error: uploadError?.message || 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(storagePath);

    const url = urlData?.publicUrl || null;
    if (!url) {
      return NextResponse.json({ error: 'Failed to resolve public URL' }, { status: 500 });
    }

    const { error: updateError } = await db
      .from('photos')
      .update({
        url,
      })
      .eq('id', id)
      .eq('tenant_id', user.tenantId);

    if (updateError) {
      console.error('[photos/[id]/upload] update error:', updateError?.message);
      return NextResponse.json({ error: updateError?.message || 'Failed to update photo' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url });
  } catch (err: unknown) {
    console.error('[photos/[id]/upload] error: Internal server error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
