import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { signUrl } from '@/lib/storage-signing';
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const db = createServerClient();
    const { data, error } = await db.from('photos').insert({
      tenant_id: user.tenantId,
      project_id: body.projectId,
      title: body.title || '',
      description: body.description || '',
      album: body.album || 'General',
      taken_at: body.taken_at || new Date().toISOString(),
      url: body.url || '',
      tags: body.tags || [],
      taken_by: body.taken_by || '',
    }).select().single();
    if (error) throw error;
    // sign the URL for immediate display (project-files bucket is private)
    if (data?.url) (data as any).url = await signUrl((data as any).url);
    return NextResponse.json({ success: true, photo: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
