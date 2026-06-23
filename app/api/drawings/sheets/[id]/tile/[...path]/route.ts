import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { verifyTileToken } from '@/lib/tile-token';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/drawings/sheets/[id]/tile/[...path]
 *
 * Authenticated streaming proxy for DZI tiles. The `blueprints` bucket is
 * private, so OpenSeadragon can't hit storage directly. Instead the viewer
 * loads the descriptor (sheet.dzi) and every tile (sheet_files/<lvl>/<x>_<y>.jpeg)
 * through this route, which:
 *   1) authenticates the user (Bearer header or sb-access-token cookie),
 *   2) verifies the sheet belongs to the caller's tenant,
 *   3) downloads the object with the service role and streams the bytes.
 *
 * path-traversal is blocked and responses are marked private/cacheable so the
 * browser re-uses tiles without re-hitting the origin on every pan.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path } = await params;

  const rel = (path || []).join('/');
  if (!rel || rel.includes('..') || rel.startsWith('/')) {
    return NextResponse.json({ error: 'Bad path' }, { status: 400 });
  }

  // Auth: a signed tile token in the query string (covers <img>/navigator loads),
  // otherwise fall back to the normal Bearer-header / cookie session.
  const token = new URL(req.url).searchParams.get('t');
  let tenantId: string | null = token ? (verifyTileToken(token, id)?.tenantId ?? null) : null;
  if (!tenantId) {
    const user = await getUser(req);
    tenantId = user?.tenantId ?? null;
  }
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data: sheet } = await db
    .from('drawing_sheets')
    .select('id, tenant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();
  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });

  const { data, error } = await db.storage.from('blueprints').download(`tiles/${id}/${rel}`);
  if (error || !data) return NextResponse.json({ error: 'Tile not found' }, { status: 404 });

  const buf = Buffer.from(await data.arrayBuffer());
  const ct = rel.endsWith('.dzi') || rel.endsWith('.xml') ? 'application/xml'
    : rel.endsWith('.png') ? 'image/png' : 'image/jpeg';

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(buf.length),
    },
  });
}
