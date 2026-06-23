import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * POST /api/documents/combine
 * Body: { docs: [{ url, title }], title?, fileName? }
 *
 * Batch-combines multiple PDFs into one packaged document with a cover sheet /
 * table of contents (package title + every document and its start page) and a
 * labelled section divider before each document. The shareable "submittal /
 * closeout binder" Procore charges for.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { docs?: { url: string; title?: string }[]; title?: string; fileName?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const docs = (body.docs || []).filter((d) => d && d.url);
  if (docs.length === 0) return NextResponse.json({ error: 'docs[] required' }, { status: 400 });

  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const out = await PDFDocument.create();
    const bold = await out.embedFont(StandardFonts.HelveticaBold);
    const reg = await out.embedFont(StandardFonts.Helvetica);

    const GOLD = rgb(0.831, 0.627, 0.09);
    const DARK = rgb(0.05, 0.07, 0.09);
    const GRAY = rgb(0.42, 0.36, 0.26);

    const cover = out.addPage([612, 792]);
    const toc: { title: string; startPage: number }[] = [];

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      // section divider
      const divider = out.addPage([612, 792]);
      const startPage = out.getPageCount(); // 1-based page number of the divider
      divider.drawRectangle({ x: 0, y: 792 - 120, width: 612, height: 120, color: DARK });
      divider.drawText(`Section ${i + 1}`, { x: 48, y: 792 - 64, size: 12, font: bold, color: GOLD });
      divider.drawText(String(d.title || `Document ${i + 1}`).slice(0, 60), { x: 48, y: 792 - 92, size: 18, font: bold, color: rgb(1, 1, 1) });
      toc.push({ title: String(d.title || `Document ${i + 1}`), startPage });

      try {
        const res = await fetch(d.url, { signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
          const pages = await out.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        } else {
          divider.drawText('(source unavailable)', { x: 48, y: 792 - 140, size: 11, font: reg, color: GRAY });
        }
      } catch {
        divider.drawText('(could not load this document)', { x: 48, y: 792 - 140, size: 11, font: reg, color: GRAY });
      }
    }

    // Cover / table of contents
    cover.drawRectangle({ x: 0, y: 792 - 110, width: 612, height: 110, color: DARK });
    cover.drawText('SAGUARO', { x: 48, y: 792 - 52, size: 13, font: bold, color: GOLD });
    cover.drawText(String(body.title || 'Document Package').slice(0, 60), { x: 48, y: 792 - 80, size: 20, font: bold, color: rgb(1, 1, 1) });
    cover.drawText(`${docs.length} documents • ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Phoenix' })}`,
      { x: 48, y: 792 - 98, size: 9, font: reg, color: rgb(0.8, 0.8, 0.8) });

    cover.drawText('CONTENTS', { x: 48, y: 792 - 150, size: 11, font: bold, color: GRAY });
    let y = 792 - 176;
    toc.forEach((t, i) => {
      cover.drawText(`${i + 1}.  ${t.title.slice(0, 64)}`, { x: 48, y, size: 12, font: reg, color: DARK });
      cover.drawText(`p. ${t.startPage}`, { x: 520, y, size: 11, font: bold, color: GOLD });
      y -= 22;
      if (y < 60) y = 60;
    });

    const bytes = await out.save();
    const fileName = (body.fileName || 'package').replace(/[^a-z0-9_\-]+/gi, '-');
    return new NextResponse(Buffer.from(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}.pdf"` },
    });
  } catch (err) {
    console.error('[documents/combine]', err);
    return NextResponse.json({ error: 'Combine failed' }, { status: 500 });
  }
}
