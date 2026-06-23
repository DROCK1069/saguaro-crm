import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/plan-room/[token]  — PUBLIC (no login).
 * The token itself is the credential. Returns the project's current drawing
 * sheets so an invited sub can browse plans without an account.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createServerClient() as any;

  const { data: link } = await db.from('plan_room_tokens').select('*').eq('token', token).maybeSingle();
  if (!link || link.revoked) return NextResponse.json({ error: 'Invalid or revoked link' }, { status: 404 });
  if (link.expires_at && new Date(link.expires_at) < new Date()) return NextResponse.json({ error: 'Link expired' }, { status: 410 });

  await db.from('plan_room_tokens').update({ view_count: (link.view_count || 0) + 1 }).eq('id', link.id);

  let q = db.from('drawing_sheets')
    .select('id, sheet_number, sheet_title, discipline, revision_label, thumbnail_url, file_url, dzi_url')
    .eq('project_id', link.project_id).eq('tenant_id', link.tenant_id).eq('is_current', true)
    .order('sheet_number');
  const { data: sheets } = await q;

  const { data: project } = await db.from('projects').select('name').eq('id', link.project_id).maybeSingle();

  return NextResponse.json({
    label: link.label,
    project_name: project?.name || 'Project',
    sheet_count: (sheets || []).length,
    sheets: sheets || [],
  });
}
