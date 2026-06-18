import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  try {
    const db = createServerClient();

    const { count: rawCount } = await db
      .from('rfis')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', user.tenantId);

    const rfi_number = `RFI-${String((rawCount || 0) + 1).padStart(3, '0')}`;

    // Coerce dynamic JSON body values to string; returns undefined for any
    // falsy value so `?? ` reproduces the original `||` fallthrough exactly.
    const str = (v: unknown): string | undefined =>
      v ? String(v) : undefined;

    const row = {
      tenant_id:    user.tenantId,
      project_id:   str(body.projectId)   ?? str(body.project_id)  ?? null,
      rfi_number,
      subject:      str(body.subject)      ?? '',
      question:     str(body.question)     ?? str(body.description) ?? '',
      spec_section: str(body.specSection)  ?? str(body.spec_section) ?? '',
      due_date:     str(body.dueDate)      ?? str(body.due_date)     ?? null,
      status:       'open',
      submitted_by: user.email             || 'Field User',
    };

    const { data, error } = await db
      .from('rfis')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, rfi: data });
  } catch (err: unknown) {
    const msg = 'Internal server error';
    console.error('[rfis/create] error:', msg);
    return NextResponse.json(
      { error: `[rfis/create] Database error: ${msg}` },
      { status: 500 }
    );
  }
}
