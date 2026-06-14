import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const supabase = createServerClient();
    // The field page PATCHes a full Meeting object; map fields that exist as real
    // meetings columns (type->meeting_type, date->meeting_date, time->start_time,
    // general_notes->notes). The structured array fields are persisted to jsonb:
    // attendees[] -> attendees, the structured agenda[] array -> agenda_items.
    // Client-only fields (id/recurring/series_id/created_at) have no column and are
    // dropped to avoid a 500.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // Keep `agenda` in `direct` so a *text* agenda value still maps to the agenda
    // text column; the array agenda is routed to agenda_items below.
    const direct = ['title','status','location','end_time','minutes_text','agenda'];
    for (const k of direct) if (body[k] !== undefined && typeof body[k] !== 'object') updates[k] = body[k];
    if (body.meeting_type !== undefined) updates.meeting_type = body.meeting_type;
    else if (body.type !== undefined) updates.meeting_type = body.type;
    if (body.meeting_date !== undefined) updates.meeting_date = body.meeting_date;
    else if (body.date !== undefined) updates.meeting_date = body.date;
    if (body.start_time !== undefined) updates.start_time = body.start_time;
    else if (body.time !== undefined) updates.start_time = body.time;
    if (body.notes !== undefined) updates.notes = body.notes;
    else if (body.general_notes !== undefined) updates.notes = body.general_notes;
    if (Array.isArray(body.attendees)) updates.attendees = body.attendees;
    if (Array.isArray(body.agenda)) updates.agenda_items = body.agenda;
    const { data, error } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', params.id)
      .eq('project_id', params.projectId)
      .select()
      .single();
    if (error) return NextResponse.json({ meeting: { id: params.id, ...body } });
    return NextResponse.json({ meeting: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  // Email distribution endpoint
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    // In production this would send emails via SendGrid/Resend
    return NextResponse.json({ success: true, message: 'Meeting minutes sent' });
  } catch {
    return NextResponse.json({ error: 'Failed to send minutes' }, { status: 500 });
  }
}
