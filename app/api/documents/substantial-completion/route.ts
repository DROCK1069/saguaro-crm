import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { generateSubstantialCompletionCert } from '@/lib/document-templates/substantial-completion-cert-generator';

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

    const result = await generateSubstantialCompletionCert({
      projectId: body.projectId,
      completionDate: body.completionDate || new Date().toISOString().split('T')[0],
    });

    return NextResponse.json({ pdfUrl: result.pdfUrl, success: true });
  } catch (err: unknown) {
    const message = 'Document generation failed';
    console.error('[documents/substantial-completion]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
