import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * Per-folder document permissions (Procore-style granular access).
 *
 *  GET    ?projectId=  → list permission rules for a project
 *  POST   { projectId, folder, principalType:'user'|'role', principalId, access }
 *         → grant/replace a rule
 *  DELETE ?id=         → remove a rule
 *
 * A folder with NO rules is open to the tenant; once any rule exists for a
 * folder it becomes restricted to the granted users/roles (see lib/folder-access).
 */

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(req.url).searchParams.get('projectId');
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServerClient() as any;
    let q = db.from('document_folder_permissions').select('*').eq('tenant_id', user.tenantId).order('folder', { ascending: true });
    if (projectId) q = q.eq('project_id', projectId);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ permissions: data || [] });
  } catch (err) {
    console.error('[folder-permissions] GET', err);
    return NextResponse.json({ error: 'Could not load permissions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let b: { projectId?: string; folder?: string; principalType?: string; principalId?: string; access?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!b.folder || !b.principalId) return NextResponse.json({ error: 'folder and principalId required' }, { status: 400 });

  const principalType = b.principalType === 'user' ? 'user' : 'role';
  const access = ['none', 'view', 'edit', 'admin'].includes(b.access || '') ? b.access : 'view';

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServerClient() as any;
    const projectId = b.projectId && /^[0-9a-f-]{36}$/i.test(b.projectId) ? b.projectId : null;
    // replace any existing rule for the same folder/principal
    await db.from('document_folder_permissions').delete()
      .eq('tenant_id', user.tenantId).eq('folder', b.folder)
      .eq('principal_type', principalType).eq('principal_id', b.principalId)
      .filter('project_id', projectId ? 'eq' : 'is', projectId);
    const { data, error } = await db.from('document_folder_permissions').insert({
      tenant_id: user.tenantId, project_id: projectId, folder: b.folder,
      principal_type: principalType, principal_id: b.principalId, access, created_by: user.id,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ permission: data }, { status: 201 });
  } catch (err) {
    console.error('[folder-permissions] POST', err);
    return NextResponse.json({ error: 'Could not save permission' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServerClient() as any;
    const { error } = await db.from('document_folder_permissions').delete().eq('id', id).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[folder-permissions] DELETE', err);
    return NextResponse.json({ error: 'Could not delete permission' }, { status: 500 });
  }
}
