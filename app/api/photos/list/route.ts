import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { signFields } from '@/lib/storage-signing';
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ photos: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  try {
    const db = createServerClient();
    let query = db.from('photos').select('*').eq('tenant_id', user.tenantId).order('taken_at', { ascending: false }).limit(1000);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    // 'project-files' bucket is private — sign photo URLs on read.
    return NextResponse.json({ photos: await signFields(data || [], ['url', 'thumbnail_url', 'markup_url']) });
  } catch {
    return NextResponse.json({ photos: [] }, { status: 500 });
  }
}
