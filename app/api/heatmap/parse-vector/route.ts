import { NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { parseVectorPdf } from '@/lib/heatmap/vector-pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Vector-CAD / PDF parser endpoint.
 *
 * Consumed by BOTH web and the mobile app (mobile can't run pdfjs, so it posts
 * the raw PDF here). Returns exact wall geometry + a best-effort drawing scale
 * so the Coverage Heatmap tool can import survey-grade walls with no AI raster
 * guessing. Bad / scanned PDFs come back as { ok:false, error } with HTTP 200 —
 * never a 500 HTML page.
 *
 * Body: { pdf: string (base64, optionally a data: URL), page?: number }
 */
export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 200 });
  }

  const rawPdf = body?.pdf;
  if (typeof rawPdf !== 'string' || !rawPdf.trim()) {
    return Response.json({ ok: false, error: 'Missing "pdf" (base64 string)' }, { status: 200 });
  }

  // Strip an optional data: URL prefix (e.g. "data:application/pdf;base64,....").
  const b64 = rawPdf.includes(',') ? rawPdf.slice(rawPdf.indexOf(',') + 1) : rawPdf;

  let bytes: Uint8Array;
  try {
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) throw new Error('empty');
    bytes = new Uint8Array(buf);
  } catch {
    return Response.json({ ok: false, error: 'Could not decode base64 PDF' }, { status: 200 });
  }

  let page: number | undefined;
  if (body?.page != null) {
    const p = Number(body.page);
    if (Number.isFinite(p) && p >= 1) page = Math.floor(p);
  }

  try {
    const result = await parseVectorPdf(bytes, page ? { page } : undefined);
    return Response.json(result, { status: 200 });
  } catch (err: any) {
    // Defensive: parseVectorPdf already traps its own errors, but never let a
    // throw escape as a 500 HTML page — the mobile client expects JSON.
    return Response.json(
      { ok: false, error: `Vector parse failed: ${err?.message || 'unknown error'}` },
      { status: 200 },
    );
  }
}
