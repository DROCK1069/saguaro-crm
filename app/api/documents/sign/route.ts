import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * POST /api/documents/sign
 * Body: { url, signature (PNG data URL), signerName, signerTitle?, page? }
 *
 * Applies a captured signature to a PDF: embeds the signature image plus the
 * signer's name/title and a timestamped "Signed by" block onto the page,
 * then returns the signed PDF. The core of e-signing.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let b: { url?: string; signature?: string; signerName?: string; signerTitle?: string; page?: number; fileName?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!b.url || !b.signature) return NextResponse.json({ error: 'url and signature required' }, { status: 400 });

  try {
    const res = await fetch(b.url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('source fetch failed');
    const pdfBuf = Buffer.from(await res.arrayBuffer());

    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdf = await PDFDocument.load(pdfBuf, { ignoreEncryption: true });
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdf.embedFont(StandardFonts.Helvetica);

    const pages = pdf.getPages();
    const idx = Math.min(Math.max((b.page ?? pages.length) - 1, 0), pages.length - 1);
    const page = pages[idx];
    const { width } = page.getSize();

    const sigB64 = b.signature.includes(',') ? b.signature.split(',')[1] : b.signature;
    const sigBytes = Buffer.from(sigB64, 'base64');
    const isPng = sigBytes[0] === 0x89 && sigBytes[1] === 0x50;
    const sigImg = isPng ? await pdf.embedPng(sigBytes) : await pdf.embedJpg(sigBytes);

    const boxW = 230, boxX = width - boxW - 40, boxY = 40;
    const sigDims = sigImg.scaleToFit(boxW - 16, 56);
    page.drawLine({ start: { x: boxX, y: boxY + 78 }, end: { x: boxX + boxW, y: boxY + 78 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    page.drawImage(sigImg, { x: boxX + 8, y: boxY + 80, width: sigDims.width, height: sigDims.height });

    const when = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Phoenix' });
    page.drawText(`Signed by: ${String(b.signerName || user.email || 'Signer')}`, { x: boxX, y: boxY + 62, size: 10, font: bold, color: rgb(0.05, 0.07, 0.09) });
    if (b.signerTitle) page.drawText(String(b.signerTitle).slice(0, 48), { x: boxX, y: boxY + 48, size: 9, font: reg, color: rgb(0.42, 0.36, 0.26) });
    page.drawText(`Date: ${when} (MST)`, { x: boxX, y: boxY + 34, size: 8, font: reg, color: rgb(0.42, 0.36, 0.26) });
    page.drawText('Signed electronically via Saguaro', { x: boxX, y: boxY + 22, size: 7, font: reg, color: rgb(0.55, 0.5, 0.42) });

    const bytes = await pdf.save();
    const fileName = (b.fileName || 'signed-document').replace(/[^a-z0-9_\-]+/gi, '-');
    return new NextResponse(Buffer.from(bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}.pdf"` },
    });
  } catch (err) {
    console.error('[documents/sign]', err);
    return NextResponse.json({ error: 'Signing failed' }, { status: 500 });
  }
}
