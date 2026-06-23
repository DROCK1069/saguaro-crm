import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/projects/[projectId]/directory
 * Returns { companies, people, groups } for a project, pulled from
 * company-level tables (directory_companies / directory_people) joined
 * through directory_project_links so the same company/person can appear
 * across multiple projects without re-entry.
 *
 * POST creates or updates a company, person, or distribution group.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServerClient() as any;

  const { data: companyLinks } = await db.from('directory_project_links')
    .select('company_id, role_on_project')
    .eq('project_id', projectId).eq('tenant_id', user.tenantId)
    .not('company_id', 'is', null);
  const companyIds = [...new Set((companyLinks || []).map((l: any) => l.company_id).filter(Boolean))];
  let companies: any[] = [];
  if (companyIds.length) {
    const { data } = await db.from('directory_companies').select('*').in('id', companyIds);
    companies = data || [];
  }

  const { data: personLinks } = await db.from('directory_project_links')
    .select('person_id, role_on_project, permission_role')
    .eq('project_id', projectId).eq('tenant_id', user.tenantId)
    .not('person_id', 'is', null);
  const personIds = [...new Set((personLinks || []).map((l: any) => l.person_id).filter(Boolean))];
  let people: any[] = [];
  if (personIds.length) {
    const { data } = await db.from('directory_people').select('*, directory_companies(name)').in('id', personIds);
    people = (data || []).map((p: any) => {
      const link = (personLinks || []).find((l: any) => l.person_id === p.id);
      return {
        ...p,
        company_name: p.directory_companies?.name || null,
        role_on_project: link?.role_on_project || null,
        permission_role: link?.permission_role || 'Read-Only',
      };
    });
  }

  const { data: groups } = await db.from('distribution_groups')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .or(`project_id.eq.${projectId},project_id.is.null`);

  return NextResponse.json({ companies, people, groups: groups || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServerClient() as any;
  const body = await req.json();

  if (body.type === 'company') {
    const record: any = {
      tenant_id: user.tenantId,
      name: body.name, trade: body.trade || null,
      license_number: body.license_number || null,
      phone: body.phone || null, email: body.email || null,
      address: body.address || null,
      insurance_expiry: body.insurance_expiry || null,
    };
    let companyId = body.id;
    if (companyId) {
      await db.from('directory_companies').update({ ...record, updated_at: new Date().toISOString() }).eq('id', companyId).eq('tenant_id', user.tenantId);
    } else {
      const { data, error } = await db.from('directory_companies').insert(record).select('id').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      companyId = data.id;
    }
    const { data: existing } = await db.from('directory_project_links')
      .select('id').eq('company_id', companyId).eq('project_id', projectId).eq('tenant_id', user.tenantId).maybeSingle();
    if (!existing) {
      await db.from('directory_project_links').insert({ tenant_id: user.tenantId, project_id: projectId, company_id: companyId });
    }
    return NextResponse.json({ company: { id: companyId, ...record } });
  }

  if (body.type === 'person') {
    const record: any = {
      tenant_id: user.tenantId,
      name: body.name, title: body.title || null,
      company_id: body.company_id || null,
      phone: body.phone || null, email: body.email || null,
    };
    let personId = body.id;
    if (personId) {
      await db.from('directory_people').update({ ...record, updated_at: new Date().toISOString() }).eq('id', personId).eq('tenant_id', user.tenantId);
      await db.from('directory_project_links').update({ role_on_project: body.role_on_project || null, permission_role: body.permission_role || 'Read-Only' })
        .eq('person_id', personId).eq('project_id', projectId).eq('tenant_id', user.tenantId);
    } else {
      const { data, error } = await db.from('directory_people').insert(record).select('id').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      personId = data.id;
    }
    const { data: existing } = await db.from('directory_project_links')
      .select('id').eq('person_id', personId).eq('project_id', projectId).eq('tenant_id', user.tenantId).maybeSingle();
    if (!existing) {
      await db.from('directory_project_links').insert({
        tenant_id: user.tenantId, project_id: projectId, person_id: personId,
        role_on_project: body.role_on_project || null,
        permission_role: body.permission_role || 'Read-Only',
      });
    }
    return NextResponse.json({ person: { id: personId, ...record, role_on_project: body.role_on_project, permission_role: body.permission_role } });
  }

  if (body.type === 'group') {
    const record: any = { tenant_id: user.tenantId, project_id: projectId, name: body.name, member_ids: body.member_ids || [] };
    if (body.id) {
      await db.from('distribution_groups').update({ name: body.name, member_ids: body.member_ids || [] }).eq('id', body.id).eq('tenant_id', user.tenantId);
      return NextResponse.json({ group: { id: body.id, ...record } });
    }
    const { data, error } = await db.from('distribution_groups').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ group: data });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
