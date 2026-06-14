import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const db = createServerClient();
    const { data, error } = await db.from('subcontractors').select('*').eq('id', id).single();
    if (error) throw error;
    return NextResponse.json({ sub: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const db = createServerClient();
    // Map legacy/client field names to real columns and drop non-existent ones
    // so updates don't 500 on schema-divergent payloads.
    const columnMap: Record<string, string> = {
      name: 'company_name',
      licenseNumber: 'license_number',
      licenseState: 'license_state',
    };
    const dropKeys = new Set(['project_id', 'projectId', 'contract_amount', 'contractAmount', 'w9_status']);
    const validColumns = new Set([
      'company_name', 'contact_name', 'email', 'contact_email', 'phone', 'contact_phone',
      'address', 'city', 'state', 'zip', 'trade', 'trades', 'license_number', 'license_state',
      'license_expiry', 'license_expiration', 'license_type', 'insurance_expiry', 'w9_on_file',
      'ein', 'status', 'rating', 'notes', 'tags', 'dba_name', 'bonding_capacity',
    ]);
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (dropKeys.has(k)) continue;
      const mapped = columnMap[k] || k;
      if (validColumns.has(mapped)) updates[mapped] = v;
    }
    const { data, error } = await db.from('subcontractors').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ sub: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
