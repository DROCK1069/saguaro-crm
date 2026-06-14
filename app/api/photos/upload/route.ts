import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const image = formData.get('image') as File | null;
    const upload = file || image;
    const projectId = (formData.get('projectId') as string) || '';
    const category  = (formData.get('category')  as string) || 'Progress';
    const caption   = (formData.get('caption')   as string) || '';
    const filename  = upload?.name || `photo-${Date.now()}.jpg`;

    if (!upload) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const buffer = Buffer.from(await upload.arrayBuffer());
    const storagePath = `projects/${projectId}/photos/${Date.now()}-${filename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, buffer, { contentType: upload.type || 'image/jpeg' });

    if (uploadError || !uploadData) {
      console.error('[photos/upload] storage error:', uploadError?.message);
      return NextResponse.json({ error: uploadError?.message || 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(storagePath);

    const url = urlData?.publicUrl || null;
    if (!url) {
      return NextResponse.json({ error: 'Failed to resolve public URL' }, { status: 500 });
    }

    // Persist a row so the photo shows up in photos/list (reads from `photos`).
    const db = createServerClient();
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
        taken_at: new Date().toISOString(),
        file_size: upload.size,
        mime_type: upload.type || 'image/jpeg',
      })
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
