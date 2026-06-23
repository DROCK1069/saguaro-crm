import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/drawings/auto-split
 * Body: { fileUrl, projectId, setName?, discipline? }
 *
 * The Procore flagship, matched: upload a multi-page drawing-set PDF and this
 *  1) splits it into individual sheets (pdf-lib),
 *  2) rasterizes each page (sharp) for display + thumbnail,
 *  3) OCRs the title block (Claude vision) to auto-name sheet number/title/discipline,
 *  4) auto-manages revisions — a new sheet with an existing sheet number
 *     supersedes the old one and bumps the revision label.
 *
 * AI/storage run with the production env (service role + ANTHROPIC_API_KEY);
 * the split/rasterize mechanics are environment-independent.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let sharpMod: any = null;
async function getSharp(): Promise<any> {
  if (sharpMod) return sharpMod;
  try { sharpMod = (await import('sharp' as any)).default; return sharpMod; } catch { return null; }
}

function nextRev(label?: string | null): string {
  const s = (label || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(s)) return String.fromCharCode(Math.min(90, s.charCodeAt(0) + 1));
  const n = parseInt(s, 10);
  if (!isNaN(n)) return String(n + 1);
  return 'B';
}

async function ocrTitleBlock(jpeg: Buffer): Promise<{ sheet_number: string; sheet_title: string; discipline: string } | null> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const msg: any = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
          { type: 'text', text: 'This is a construction drawing sheet. Read the title block and reply ONLY with compact JSON: {"sheet_number":"e.g. A-101","sheet_title":"e.g. FOUNDATION PLAN","discipline":"Architectural|Structural|Mechanical|Electrical|Plumbing|Civil|General"}. Use empty strings if unreadable.' },
        ],
      }],
    });
    const txt = (msg.content?.[0] as any)?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    return { sheet_number: String(j.sheet_number || ''), sheet_title: String(j.sheet_title || ''), discipline: String(j.discipline || 'General') };
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { fileUrl?: string; projectId?: string; setName?: string; discipline?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!body.fileUrl || !body.projectId) return NextResponse.json({ error: 'fileUrl and projectId required' }, { status: 400 });

  try {
    const srcRes = await fetch(body.fileUrl, { signal: AbortSignal.timeout(30000) });
    if (!srcRes.ok) throw new Error('source fetch failed');
    const pdfBuf = Buffer.from(await srcRes.arrayBuffer());

    const { PDFDocument } = await import('pdf-lib');
    const src = await PDFDocument.load(pdfBuf, { ignoreEncryption: true });
    const total = Math.min(src.getPageCount(), 60); // cap per request

    const db = createServerClient();
    const { data: set, error: setErr } = await db.from('drawing_sets').insert({
      tenant_id: user.tenantId, project_id: body.projectId,
      name: body.setName || 'Drawing Set', total_sheets: total,
      upload_complete: false, upload_started_at: new Date().toISOString(),
    }).select().single();
    if (setErr || !set) throw setErr || new Error('set create failed');

    const sharp = await getSharp();
    const sheets: any[] = [];

    for (let i = 0; i < total; i++) {
      // 1) split page i into its own PDF
      const one = await PDFDocument.create();
      const [pg] = await one.copyPages(src, [i]);
      one.addPage(pg);
      const oneBytes = Buffer.from(await one.save());

      // 2) rasterize for display / thumb / OCR
      let displayBuf: Buffer | null = null, thumbBuf: Buffer | null = null, ocrBuf: Buffer | null = null;
      if (sharp) {
        try {
          displayBuf = await sharp(oneBytes, { density: 150, pages: 1 }).resize(2200, 2200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
          thumbBuf = await sharp(displayBuf).resize(400, 400, { fit: 'inside' }).jpeg({ quality: 75 }).toBuffer();
          ocrBuf = await sharp(displayBuf).resize(1500, 1500, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
        } catch { /* rasterize failed — keep going */ }
      }

      // 3) upload display + thumbnail
      const base = `drawing-sheets/${set.id}/${i}`;
      let fileUrl = body.fileUrl, thumbUrl: string | null = null;
      if (displayBuf) {
        await db.storage.from('blueprints').upload(`${base}/page.jpg`, displayBuf, { contentType: 'image/jpeg', upsert: true });
        fileUrl = db.storage.from('blueprints').getPublicUrl(`${base}/page.jpg`).data.publicUrl;
      }
      if (thumbBuf) {
        await db.storage.from('blueprints').upload(`${base}/thumb.jpg`, thumbBuf, { contentType: 'image/jpeg', upsert: true });
        thumbUrl = db.storage.from('blueprints').getPublicUrl(`${base}/thumb.jpg`).data.publicUrl;
      }

      // 4) OCR the title block
      const ocr = ocrBuf ? await ocrTitleBlock(ocrBuf) : null;
      const sheetNumber = (ocr?.sheet_number || '').trim() || `S-${String(i + 1).padStart(3, '0')}`;
      const sheetTitle = (ocr?.sheet_title || '').trim() || `Sheet ${i + 1}`;
      const discipline = (ocr?.discipline || body.discipline || 'General').trim() || 'General';

      // 5) auto-revision — supersede an existing current sheet with the same number
      const { data: existing } = await db.from('drawing_sheets')
        .select('id, revision_label')
        .eq('tenant_id', user.tenantId).eq('project_id', body.projectId)
        .eq('sheet_number', sheetNumber).eq('is_current', true).limit(1);
      const prior = existing?.[0];

      const { data: row, error: rowErr } = await db.from('drawing_sheets').insert({
        drawing_set_id: set.id, project_id: body.projectId, tenant_id: user.tenantId,
        sheet_number: sheetNumber, sheet_title: sheetTitle, discipline,
        file_url: fileUrl, file_path: `${base}/page.jpg`, thumbnail_url: thumbUrl,
        revision_label: prior ? nextRev(prior.revision_label) : 'A',
        is_current: true, supersedes: prior?.id || null, sort_order: i, ai_tagged: !!ocr,
      }).select().single();
      if (rowErr || !row) continue;

      if (prior) await db.from('drawing_sheets').update({ is_current: false, superseded_by: row.id }).eq('id', prior.id);
      sheets.push(row);
    }

    await db.from('drawing_sets').update({ upload_complete: true, upload_completed_at: new Date().toISOString() }).eq('id', set.id);
    return NextResponse.json({ set, sheetsCreated: sheets.length, sheets });
  } catch (err) {
    console.error('[drawings/auto-split]', err);
    return NextResponse.json({ error: 'Auto-split failed' }, { status: 500 });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
