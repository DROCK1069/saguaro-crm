import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * POST /api/markup/flatten
 * Body: { baseUrl: string, overlay?: <PNG data URL>, title?, fileName? }
 *
 * "Export with markups": the client sends the base sheet URL plus a
 * transparent PNG of the markup layers (strokes/shapes/text/pins). The server
 * fetches the base image and composites the markups over it with sharp (avoids
 * client-side canvas cross-origin taint), then burns the result into a
 * flattened, shareable PDF.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let sharpMod: any = null;
async function getSharp(): Promise<any> {
  if (sharpMod) return sharpMod;
  try { sharpMod = (await import('sharp' as any)).default; return sharpMod; } catch { return null; }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { baseUrl?: string; overlay?: string; title?: string; fileName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body.baseUrl) return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });

  try {
    const baseRes = await fetch(body.baseUrl, { signal: AbortSignal.timeout(15000) });
    if (!baseRes.ok) throw new Error('base fetch failed');
    const baseBuf = Buffer.from(await baseRes.arrayBuffer());

    const sharp = await getSharp();
    let composed = baseBuf;

    if (sharp) {
      const meta = await sharp(baseBuf).metadata();
      const W = meta.width || 1600;
      const H = meta.height || 1200;
      if (body.overlay) {
        const ovB64 = body.overlay.includes(',') ? body.overlay.split(',')[1] : body.overlay;
        const ovResized = await sharp(Buffer.from(ovB64, 'base64')).resize(W, H, { fit: 'fill' }).png().toBuffer();
        composed = await sharp(baseBuf).composite([{ input: ovResized }]).png().toBuffer();
      } else {
        composed = await sharp(baseBuf).png().toBuffer();
      }
    }

    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const isPng = composed[0] === 0x89 && composed[1] === 0x50;
    const img = isPng ? await pdf.embedPng(composed) : await pdf.embedJpg(composed);

    const margin = 24;
    const titleH = body.title ? 30 : 0;
    const page = pdf.addPage([img.width + margin * 2, img.height + margin * 2 + titleH]);
    const pageH = page.getHeight();

    if (body.title) {
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const sub = await pdf.embedFont(StandardFonts.Helvetica);
      page.drawText(String(body.title).slice(0, 110), { x: margin, y: pageH - margin - 8, size: 13, font, color: rgb(0.05, 0.07, 0.09) });
      page.drawText(`Exported with markups • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Phoenix' })}`,
        { x: margin, y: pageH - margin - 22, size: 8, font: sub, color: rgb(0.42, 0.36, 0.26) });
    }
    page.drawImage(img, { x: margin, y: margin, width: img.width, height: img.height });

    const out = await pdf.save();
    const fileName = (body.fileName || 'marked-up-sheet').replace(/[^a-z0-9_\-]+/gi, '-');
    return new NextResponse(Buffer.from(out), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}.pdf"` },
    });
  } catch (err) {
    console.error('[markup/flatten]', err);
    return NextResponse.json({ error: 'Could not flatten markups' }, { status: 500 });
  }
}
