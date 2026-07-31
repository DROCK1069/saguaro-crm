/**
 * Plan-reading AI — auto symbol-count + auto-scale. Claude vision counts every
 * countable element on a sheet (doors, fixtures, receptacles, columns…), reads
 * the title-block scale, and locates a labeled dimension so the tracer can
 * auto-calibrate. Counts map to takeoff count-assemblies where we have them.
 */
import { NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { ASSEMBLIES } from '@/lib/takeoff';

export const runtime = 'nodejs';
export const maxDuration = 120;
/* eslint-disable @typescript-eslint/no-explicit-any */

const SYSTEM = 'You are a senior estimator doing a symbol count on a construction sheet. Count carefully and completely. Return ONLY raw JSON.';

function extractJson(raw: string): any {
  let t = raw.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try { return JSON.parse(t); } catch { /* */ }
  const s = t.indexOf('{'); if (s < 0) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = s; i < t.length; i++) { const ch = t[i]; if (esc) { esc = false; continue; } if (ch === '\\' && inStr) { esc = true; continue; } if (ch === '"') { inStr = !inStr; continue; } if (inStr) continue; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } } }
  return end < 0 ? null : (() => { try { return JSON.parse(t.slice(s, end + 1)); } catch { return null; } })();
}

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI not configured' }, { status: 200 });

  let body: { image?: string; imgW?: number; imgH?: number };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!body.image) return Response.json({ error: 'Image required' }, { status: 400 });
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(body.image);
  const media = (m?.[1] || 'image/png') as any;
  const b64 = m?.[2] || body.image;

  const countAssemblies = Object.values(ASSEMBLIES).filter((a) => a.appliesTo === 'count').map((a) => `"${a.id}" (${a.name})`).join(', ');
  const prompt = `This sheet is ${body.imgW || '?'}px × ${body.imgH || '?'}px.

1) COUNT every countable element on this sheet — doors, windows, plumbing fixtures, light fixtures, receptacles, data/comm outlets, sprinkler heads, diffusers, columns, whatever is drawn/scheduled. Be thorough and exact.
2) Read the TITLE-BLOCK SCALE if shown (e.g. 1/8" = 1'-0").
3) Find ONE clearly labeled dimension and give its two endpoint pixel coordinates + its real length in feet, so the plan can auto-calibrate.

Map a count to one of these takeoff assemblies when it fits: ${countAssemblies}. Otherwise leave "assembly" empty.

Return ONLY:
{"scale":{"text":"1/8\\" = 1'-0\\"","confidence":0-100},
 "calibration":{"knownFt":20,"p1":{"x":100,"y":200},"p2":{"x":540,"y":200}},
 "counts":[{"symbol":"Door","count":12,"assembly":"door_frame","csi":"08 11 00","confidence":0-100}],
 "notes":["short"]}`;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 3000, system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
        { type: 'text', text: prompt },
      ] }],
    });
    const text = (resp.content || []).filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const parsed = extractJson(text);
    if (!parsed) return Response.json({ error: 'Could not read the sheet' }, { status: 200 });

    // auto-calibration → pxPerFt
    let pxPerFt: number | null = null;
    const cal = parsed.calibration;
    if (cal?.p1 && cal?.p2 && cal.knownFt > 0) {
      const px = Math.hypot(cal.p2.x - cal.p1.x, cal.p2.y - cal.p1.y);
      if (px > 0) pxPerFt = Math.round((px / cal.knownFt) * 1000) / 1000;
    }
    const counts = (parsed.counts || []).filter((c: any) => c && c.count > 0).map((c: any) => ({
      symbol: String(c.symbol || 'item'), count: Math.round(+c.count),
      assembly: c.assembly && ASSEMBLIES[c.assembly] ? c.assembly : null, csi: c.csi || '', confidence: c.confidence ?? null,
    }));
    return Response.json({ scale: parsed.scale || null, pxPerFt, calibration: cal || null, counts, notes: parsed.notes || [] });
  } catch (err: any) {
    console.error('[takeoff/count-symbols] count failed:', err);
    return Response.json({ error: 'The symbol count could not be completed. Please try again.' }, { status: 200 });
  }
}
