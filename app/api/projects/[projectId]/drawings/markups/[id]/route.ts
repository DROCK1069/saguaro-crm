import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const supabase = createServerClient();

    // Real drawing_markups columns only. The markup payload column is `data` (jsonb),
    // not `markup_data`; title / visibility / line_width are not columns on this table —
    // stroke geometry & width live inside the `data` jsonb. updated_by is a uuid column.
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };
    if (body.markup_data !== undefined) updates.data = body.markup_data;
    if (body.color !== undefined) updates.color = body.color;
    if (body.page_number !== undefined) updates.page_number = body.page_number;

    const { data, error } = await supabase
      .from('drawing_markups')
      .update(updates)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ markup: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update markup' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('drawing_markups')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete markup' }, { status: 500 });
  }
}

/** POST a comment on a markup */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const supabase = createServerClient();

    if (!body.comment?.trim()) {
      return NextResponse.json({ error: 'comment is required' }, { status: 400 });
    }

    // drawing_markup_comments columns: markup_id, content (NOT NULL), author_name (NOT NULL).
    // There is no `comment` or `author` column — the body text goes in `content`.
    const row = {
      markup_id: id,
      content: body.comment.trim(),
      author_name: body.author_name || user.email,
    };

    const { data, error } = await supabase
      .from('drawing_markup_comments')
      .insert(row)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ comment: data });
  } catch {
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
