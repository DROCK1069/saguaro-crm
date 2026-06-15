import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const db = createServerClient();
    const fields: Record<string, any> = {};
    // Pass through the plain allow-listed columns (web sends these directly).
    const allowed = ['title','description','album','taken_at','tags','taken_by'];
    for (const k of allowed) { if (body[k] !== undefined) fields[k] = body[k]; }
    // Caption: mobile maps caption -> {description} but the photos grid/lightbox
    // READS `caption` first (list does `caption ?? description`). Accept either
    // key and write to the `caption` column so the edit actually shows up.
    const captionVal = body.caption ?? body.description;
    if (captionVal !== undefined) fields.caption = captionVal;
    // file_name -> real `filename` column (mobile maps file_name -> title above,
    // but also accept the underlying column name).
    const filenameVal = body.filename ?? body.file_name;
    if (filenameVal !== undefined) fields.filename = filenameVal;
    const { error } = await db.from('photos').update(fields).eq('id', id).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = createServerClient();
    const { error } = await db.from('photos').delete().eq('id', id).eq('tenant_id', user.tenantId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
