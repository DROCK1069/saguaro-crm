import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { signUrl } from '@/lib/storage-signing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Public drawing-review feed (B4 contract) — token-gated, no auth, READ-ONLY.
 *
 * GET ?token= -> {
 *   drawing: { id, label, fileUrl, fileType, pages? },
 *   markups: [drawing_markups rows, 'link' rows excluded],
 *   generatedAt,
 *   // extras the portal page renders (additive to the contract):
 *   projectName, linkLabel, sheetId, drawingId
 * }
 * 401 on invalid / expired / revoked tokens. Service-role client; every query
 * is pinned to the link row's tenant + drawing so nothing else can leak.
 */

function isPdf(url: string, fileType?: string | null): boolean {
  if (fileType && /pdf/i.test(fileType)) return true;
  return /\.pdf(\?|$)/i.test(url || '');
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
  try {
    const db = createServerClient() as any;
    const { data: link } = await db
      .from('drawing_review_links')
      .select('*')
      .eq('token', token)
      .is('revoked_at', null)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Link expired or revoked' }, { status: 401 });
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Link expired or revoked' }, { status: 401 });
    }

    // Resolve the file: sheet-scoped links render the sheet's file, otherwise
    // the drawing's. Both lookups stay pinned to the link's tenant.
    let id = '';
    let label = '';
    let rawUrl = '';
    let fileType = '';
    if (link.drawing_sheet_id) {
      const { data: sheet } = await db
        .from('drawing_sheets')
        .select('id, sheet_number, sheet_title, file_url, file_type')
        .eq('id', link.drawing_sheet_id)
        .eq('tenant_id', link.tenant_id)
        .maybeSingle();
      if (!sheet) return NextResponse.json({ error: 'Link expired or revoked' }, { status: 401 });
      id = sheet.id;
      label = [sheet.sheet_number, sheet.sheet_title].filter(Boolean).join(' — ') || 'Sheet';
      rawUrl = sheet.file_url || '';
      fileType = isPdf(rawUrl, sheet.file_type) ? 'application/pdf' : 'image';
    } else if (link.drawing_id) {
      const { data: drawing } = await db
        .from('drawings')
        .select('id, name, sheet_number, url')
        .eq('id', link.drawing_id)
        .eq('tenant_id', link.tenant_id)
        .maybeSingle();
      if (!drawing) return NextResponse.json({ error: 'Link expired or revoked' }, { status: 401 });
      id = drawing.id;
      label = [drawing.sheet_number, drawing.name].filter(Boolean).join(' — ') || 'Drawing';
      rawUrl = drawing.url || '';
      fileType = isPdf(rawUrl) ? 'application/pdf' : 'image';
    } else {
      return NextResponse.json({ error: 'Link expired or revoked' }, { status: 401 });
    }
    if (!rawUrl) return NextResponse.json({ error: 'This drawing has no file attached' }, { status: 404 });

    // Markups for exactly this drawing/sheet, tenant-pinned. 'link' rows are
    // internal cross-references — never shown to outside reviewers.
    let mq = db
      .from('drawing_markups')
      .select('*')
      .eq('tenant_id', link.tenant_id)
      .neq('markup_type', 'link')
      .order('created_at', { ascending: true })
      .limit(2000);
    mq = link.drawing_sheet_id
      ? mq.eq('drawing_sheet_id', link.drawing_sheet_id)
      : mq.eq('drawing_id', link.drawing_id);
    const { data: markups, error: mErr } = await mq;
    if (mErr) throw mErr;

    // Project label for the brand-neutral header.
    let projectName = '';
    if (link.project_id) {
      const { data: proj } = await db
        .from('projects')
        .select('name')
        .eq('id', link.project_id)
        .maybeSingle();
      projectName = proj?.name || '';
    }

    return NextResponse.json({
      drawing: {
        id,
        label,
        fileUrl: await signUrl(rawUrl, 3600),
        fileType,
        // pages is intentionally absent: page count is only knowable once
        // pdf.js opens the file — the portal page reports it client-side.
      },
      markups: markups || [],
      generatedAt: new Date().toISOString(),
      projectName,
      linkLabel: link.label || '',
      drawingId: link.drawing_id || null,
      sheetId: link.drawing_sheet_id || null,
    });
  } catch (e: unknown) {
    console.error('[portal drawing-review] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
