import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { generateJHA } from '@/lib/document-templates/jha-generator';

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Documents', 'Edit');
  if (!g.ok) return g.res;
  try {
    const user = await getUser(req);
    const body = await req.json();
    const db = createServerClient();

    const { data: project } = await db
      .from('projects')
      .select('*')
      .eq('id', body.projectId)
      .eq('tenant_id', g.user.tenantId)
      .single();
    const p = project as any;

    // Determine trade from request or project building type
    const trade = body.trade || p?.building_type || 'general';

    const result = await generateJHA({
      projectId: body.projectId,
      trade,
      hazards: body.hazards,
    });

    return NextResponse.json({ pdfUrl: result.pdfUrl, success: true });
  } catch (err: unknown) {
    const message = 'Document generation failed';
    console.error('[documents/jha]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
