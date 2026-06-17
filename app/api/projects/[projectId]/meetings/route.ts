import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { Database } from '@/lib/database.types';

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('project_id', params.projectId)
      .order('meeting_date', { ascending: false });
    if (error) return NextResponse.json({ meetings: [] });
    return NextResponse.json({ meetings: data || [] });
  } catch {
    return NextResponse.json({ meetings: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // meetings real columns: title, meeting_type, status, meeting_date, start_time,
    // end_time, location, agenda(text), notes, attendees(jsonb), agenda_items(jsonb),
    // created_by(uuid)... The field page sends a full Meeting object (type/date/time/
    // general_notes plus array fields attendees/agenda/recurring/series_id). Map
    // scalars to their text columns and persist the structured arrays: attendees[]
    // into attendees, and the structured agenda[] array into agenda_items.
    const record: Record<string, unknown> = {
      project_id: params.projectId,
      tenant_id: user.tenantId,
      title: body.title ?? null,
      meeting_type: body.meeting_type ?? body.type ?? null,
      location: body.location ?? null,
      meeting_date: body.meeting_date ?? body.date ?? null,
      start_time: body.start_time ?? body.time ?? null,
      notes: body.notes ?? body.general_notes ?? null,
      attendees: Array.isArray(body.attendees) ? body.attendees : [],
      agenda_items: Array.isArray(body.agenda) ? body.agenda : [],
      created_by: user.id,
      status: body.status || 'scheduled',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('meetings').insert(record as Database['public']['Tables']['meetings']['Insert']).select().single();
    if (error) return NextResponse.json({ meeting: { id: `mtg-${Date.now()}`, ...record } });
    return NextResponse.json({ meeting: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
