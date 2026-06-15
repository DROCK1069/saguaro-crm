import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { onProjectCreated } from '@/lib/triggers';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'Project name is required' }, { status: 400 });

    // Accept both camelCase (web) and snake_case (mobile) for every field the
    // clients send, and honor the user's choices instead of hard-coding them.
    const projectType = body.projectType ?? body.project_type ?? 'commercial';
    const status = body.status ?? 'active';
    // Numeric contract — the projects LIST/dashboard read `contract_value`, so
    // that column MUST be populated; mirror to the contract_amount/original_*
    // columns the web detail + financial views read.
    const contractValue = Number(body.contractValue ?? body.contract_value ?? body.contractAmount ?? body.contract_amount ?? 0) || 0;
    const startDate = body.startDate ?? body.start_date ?? null;

    const db = createServerClient();

    const { data: project, error } = await db.from('projects').insert({
      tenant_id: user.tenantId,
      name: body.name,
      address: body.address,
      state_jurisdiction: body.stateJurisdiction || 'AZ',
      project_type: projectType,
      status,
      percent_complete: 0,
      contract_value: contractValue,
      contract_amount: contractValue,
      original_contract: contractValue,
      original_contract_amount: contractValue,
      description: body.description || '',
      // Dates
      start_date: startDate,
      ntp_date: body.noticeToProceedDate || null,
      substantial_date: body.substantialCompletionDate || null,
      final_completion_date: body.finalCompletionDate || null,
      // Owner
      owner_name: body.ownerName || '',
      owner_email: body.ownerEmail || '',
      owner_entity: body.ownerName ? { name: body.ownerName, email: body.ownerEmail } : {},
      // Architect
      architect_name: body.architectName || '',
      architect_email: body.architectEmail || '',
      architect_entity: body.architectName ? { name: body.architectName, email: body.architectEmail } : {},
      // Contract settings
      retainage_pct: body.retainagePct || 10,
      is_public_project: body.publicProject || false,
      prevailing_wage: body.prevailingWage || false,
      // Extras stored in metadata
      metadata: {
        awardDate: body.awardDate || null,
        contractType: body.contractType || 'Lump Sum GMP',
      },
      created_by: user.id,
    }).select().single();

    if (error) throw error;

    const projectId = (project as any).id;

    // Trigger async scaffolding (non-blocking)
    onProjectCreated(projectId).catch(console.error);

    return NextResponse.json({ projectId, project, success: true });
  } catch (err) {
    console.error('[projects/create]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
