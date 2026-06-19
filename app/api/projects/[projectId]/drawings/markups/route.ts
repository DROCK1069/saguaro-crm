import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import type { TablesInsert } from '@/lib/database.types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServerClient();
    const url = new URL(req.url);
    const drawingId = url.searchParams.get('drawing_id');

    if (!drawingId) {
      return NextResponse.json({ error: 'drawing_id is required' }, { status: 400 });
    }

    // Markups are collaborative drawing annotations: every user on the project sees
    // all markups for the sheet. Tenant isolation is enforced by RLS; there is no
    // per-markup visibility/owner column in the schema, so no owner filter is applied.
    const { data, error } = await supabase
      .from('drawing_markups')
      .select('*')
      .eq('project_id', projectId)
      .eq('drawing_id', drawingId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Fetch comments for all returned markups
    const markupIds = (data ?? []).map((m: { id: string }) => m.id);
    let comments: Record<string, Array<{ id: string; markup_id: string; author_name: string; content: string; created_at: string | null }>> = {};

    if (markupIds.length > 0) {
      const { data: commentData } = await supabase
        .from('drawing_markup_comments')
        .select('*')
        .in('markup_id', markupIds)
        .order('created_at', { ascending: true });

      if (commentData) {
        for (const c of commentData) {
          if (!comments[c.markup_id]) comments[c.markup_id] = [];
          comments[c.markup_id].push(c);
        }
      }
    }

    const markups = (data ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      comments: comments[m.id as string] || [],
    }));

    return NextResponse.json({ markups });
  } catch {
    return NextResponse.json({ markups: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createServerClient();

    if (!body.drawing_id) {
      return NextResponse.json({ error: 'drawing_id is required' }, { status: 400 });
    }

    // This route uses the service-role client (no user JWT), so the auto_set_tenant_id
    // trigger cannot resolve tenant_id from auth.uid() — it must be set explicitly,
    // otherwise the NOT NULL tenant_id column rejects the insert.
    const row: TablesInsert<'drawing_markups'> = {
      tenant_id: user.tenantId,
      project_id: projectId,
      drawing_id: body.drawing_id,
      data: body.markup_data || {},
      markup_type: body.markup_type || 'freehand',
      color: body.color || '#EF4444',
      // created_by is a uuid column — store the auth user id, not the email.
      // The human-readable identity goes in created_by_name (text).
      created_by: user.id,
      created_by_name: body.created_by_name || user.email,
    };

    const { data, error } = await supabase
      .from('drawing_markups')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ markup: data });
  } catch {
    return NextResponse.json({ error: 'Failed to create markup' }, { status: 500 });
  }
}
