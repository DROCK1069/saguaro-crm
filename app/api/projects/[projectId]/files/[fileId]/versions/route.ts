import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * Version history for an uploaded project file, backed by the real
 * `document_versions` table (source_type='project_file', source_id=fileId).
 * Replaces the Math.random() mock version history in /field/docs.
 *
 *   GET  → { versions: [...] } ordered by version_number asc
 *   POST → create the next version  { notes? }  → { version }
 */

type Ctx = { params: Promise<{ projectId: string; fileId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { projectId, fileId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('document_versions')
      .select('id, version_number, generated_by, notes, approved, approved_by, approved_at, created_at')
      .eq('tenant_id', user.tenantId)
      .eq('source_type', 'project_file')
      .eq('source_id', fileId)
      .order('version_number', { ascending: true });
    if (error) throw error;
    void projectId;
    return NextResponse.json({ versions: data || [] });
  } catch {
    // Non-fatal: caller falls back to the file's own baseline version.
    return NextResponse.json({ versions: [] });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { projectId, fileId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { notes?: string } = {};
  try { body = await req.json(); } catch { /* notes optional */ }

  try {
    const db = createServerClient();

    // Next version number = current max + 1 (baseline file is version 1).
    const { data: existing } = await db
      .from('document_versions')
      .select('version_number')
      .eq('tenant_id', user.tenantId)
      .eq('source_type', 'project_file')
      .eq('source_id', fileId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = ((existing?.[0]?.version_number as number | undefined) ?? 1) + 1;

    const { data, error } = await db
      .from('document_versions')
      .insert({
        tenant_id: user.tenantId,
        project_id: projectId,
        source_type: 'project_file',
        source_id: fileId,
        doc_type: 'file',
        version_number: nextVersion,
        generated_by: user.email || 'user',
        notes: body.notes || null,
      })
      .select('id, version_number, generated_by, notes, created_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ version: data }, { status: 201 });
  } catch (err) {
    console.error('[files/versions] POST', err);
    return NextResponse.json({ error: 'Could not create version' }, { status: 500 });
  }
}
