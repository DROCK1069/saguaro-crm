import { NextRequest, NextResponse } from 'next/server';
import { signedUrl } from '@/lib/storage-url';
import { getUser } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ photos: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || 'unknown';

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: files, error } = await supabase.storage
      .from('project-files')
      .list(`projects/${projectId}/photos`, {
        limit: 50,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error || !files) return NextResponse.json({ photos: [] });

    const photos = await Promise.all(files
      .filter((f) => !f.name.startsWith('.'))
      .map(async (f) => {
        const url = await signedUrl(supabase, 'project-files', `projects/${projectId}/photos/${f.name}`);
        return {
          id: f.id || f.name,
          url: url || null,
          filename: f.name,
          created_at: f.created_at || new Date().toISOString(),
          category: 'Progress',
          caption: '',
        };
      }));

    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ photos: [] });
  }
}
