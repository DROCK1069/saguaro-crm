import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getPortalSession, PORTAL_PERMS } from '@/lib/portal-auth';

/** GET — list documents visible to client, grouped by category */
export async function GET(req: NextRequest) {
  try {
    // Try view_documents first, fall back to view_project
    let session = await getPortalSession(req, PORTAL_PERMS.VIEW_DOCUMENTS);
    if (!session) {
      session = await getPortalSession(req, PORTAL_PERMS.VIEW_PROJECT);
    }
    if (!session) {
      return NextResponse.json({ error: 'Access denied — insufficient permissions' }, { status: 403 });
    }

    const db = createServerClient();
    const category = req.nextUrl.searchParams.get('category');

    let query = db
      .from('portal_documents')
      .select('*')
      .eq('project_id', session.project_id)
      .eq('tenant_id', session.tenant_id)
      .eq('visible_to_client', true)
      .order('category', { ascending: true })
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: documents, error } = await query;
    if (error) throw error;

    // Group documents by category
    const grouped: Record<string, any[]> = {};
    for (const doc of documents || []) {
      const cat = doc.category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(doc);
    }

    return NextResponse.json({
      documents: documents || [],
      grouped,
      categories: Object.keys(grouped),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
