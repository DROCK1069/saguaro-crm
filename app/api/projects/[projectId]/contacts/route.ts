import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[projectId]/contacts
 * Returns project contacts for the assignee picker in
 * app/field/warranty-claims/page.tsx. The page's ContactInfo shape is
 * { name, email?, phone?, company? }.
 *
 * Source priority: project_contacts (richest) -> contacts -> project_team.
 * Scoped by tenant_id where the column exists.
 */

interface ContactRow {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_mobile?: string | null;
  phone_office?: string | null;
  company?: string | null;
  role?: string | null;
}

function normalize(rows: ContactRow[] | null | undefined) {
  return (rows ?? [])
    .filter((r) => r && (r.name || r.email))
    .map((r) => ({
      name: r.name || '',
      email: r.email || undefined,
      phone: r.phone || r.phone_mobile || r.phone_office || undefined,
      company: r.company || undefined,
    }));
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();

    // Primary: project_contacts (has tenant_id, name, email, phone_*, company).
    const pc = await supabase
      .from('project_contacts')
      .select('name, email, phone, phone_mobile, phone_office, company, role')
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .order('name', { ascending: true });
    if (!pc.error && pc.data && pc.data.length > 0) {
      return NextResponse.json({ contacts: normalize(pc.data as ContactRow[]) });
    }

    // Fallback: contacts table.
    const c = await supabase
      .from('contacts')
      .select('name, email, phone, company, role')
      .eq('project_id', params.projectId)
      .eq('tenant_id', user.tenantId)
      .order('name', { ascending: true });
    if (!c.error && c.data && c.data.length > 0) {
      return NextResponse.json({ contacts: normalize(c.data as ContactRow[]) });
    }

    // Last resort: project_team (no email/phone/company guaranteed).
    const t = await supabase
      .from('project_team')
      .select('*')
      .eq('project_id', params.projectId)
      .order('name', { ascending: true });
    if (!t.error && t.data) {
      return NextResponse.json({ contacts: normalize(t.data as ContactRow[]) });
    }

    return NextResponse.json({ contacts: [] });
  } catch {
    return NextResponse.json({ contacts: [] });
  }
}
