import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { generateDziTiles } from '@/lib/tiling';

export const runtime = 'nodejs';
export const maxDuration = 300;
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/drawings/sheets/[id]/tile
 * Builds a deep-zoom (DZI) tile pyramid for a sheet, uploads it to storage,
 * and stores dzi_url on the sheet so the TiledViewer can stream it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data: sheet } = await db.from('drawing_sheets').select('id, file_url, tenant_id').eq('id', id).eq('tenant_id', user.tenantId).single();
  if (!sheet || !sheet.file_url) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });

  await db.from('drawing_sheets').update({ tile_status: 'processing' }).eq('id', id);
  try {
    const res = await fetch(sheet.file_url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error('image fetch failed');
    const buf = Buffer.from(await res.arrayBuffer());

    const { files, levels, tileCount } = await generateDziTiles(buf);
    const baseDir = `tiles/${id}`;
    for (const f of files) {
      const path = `${baseDir}/${f.rel}`;
      await db.storage.from('blueprints').upload(path, f.buffer, { contentType: f.contentType, upsert: true });
    }

    // The `blueprints` bucket is private, so tiles are streamed back through an
    // authenticated proxy (GET /tile/[...path]) — never a public storage URL.
    const dziUrl = `/api/drawings/sheets/${id}/tile/sheet.dzi`;
    await db.from('drawing_sheets').update({ dzi_url: dziUrl, tile_status: 'complete' }).eq('id', id);
    return NextResponse.json({ dziUrl, levels, tileCount });
  } catch (err) {
    await db.from('drawing_sheets').update({ tile_status: 'failed' }).eq('id', id);
    console.error('[sheets/tile]', err);
    return NextResponse.json({ error: 'Tiling failed' }, { status: 500 });
  }
}
