import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { loadFolderRules, folderAllowed } from '@/lib/folder-access';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from('project_files').select('*').eq('project_id', params.projectId).order('created_at', { ascending: false });
    if (error) throw error;
    const files = (data || []) as Record<string, unknown>[];

    // Per-folder permission enforcement (admins/owners see everything).
    try {
      const rules = await loadFolderRules(supabase, user.tenantId, params.projectId);
      if (rules.length > 0) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const role = String((prof as { role?: string } | null)?.role || 'member');
        if (role !== 'admin' && role !== 'owner') {
          const filtered = files.filter((f) => folderAllowed(rules, String(f.category || 'Uncategorized'), user.id, role));
          return NextResponse.json({ files: filtered });
        }
      }
    } catch { /* fail open — never block document access on a permissions error */ }

    return NextResponse.json({ files });
  } catch (err: unknown) {
    console.error('[project/files] error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to fetch project files' }, { status: 500 });
  }
}
