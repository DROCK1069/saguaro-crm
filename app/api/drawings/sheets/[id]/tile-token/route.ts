import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { signTileToken } from '@/lib/tile-token';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/drawings/sheets/[id]/tile-token
 * Mints a short-lived signed descriptor URL the TiledViewer streams from.
 * The token is embedded in every tile URL so the navigator/minimap and <img>
 * loads are authorized too — not just AJAX requests with an auth header.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data: sheet } = await db
    .from('drawing_sheets')
    .select('id, tenant_id, dzi_url, tile_status')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single();
  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
  if (sheet.tile_status !== 'complete') {
    return NextResponse.json({ error: 'Tiles not ready', tile_status: sheet.tile_status || null }, { status: 409 });
  }

  const token = signTileToken(id, user.tenantId);
  const descriptorUrl = `/api/drawings/sheets/${id}/tile/sheet.dzi?t=${token}`;
  return NextResponse.json({ descriptorUrl, token, expiresIn: 7200 });
}
