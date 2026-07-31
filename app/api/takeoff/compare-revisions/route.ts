/**
 * Plan-reading AI — revision compare. Two plan images (old rev vs new rev) →
 * Claude vision reports exactly what changed (added/removed/moved/modified),
 * the trade, and the likely cost direction. Estimators lose money missing
 * revision deltas; this catches them.
 */
import { NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';

export const runtime = 'nodejs';
export const maxDuration = 120;
/* eslint-disable @typescript-eslint/no-explicit-any */

const SYSTEM = 'You are a senior estimator comparing two revisions of the same construction drawing. Report only real, visible differences. Return ONLY raw JSON.';

function extractJson(raw: string): any {
  const t = raw.replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try { return JSON.parse(t); } catch { /* */ }
  const s = t.indexOf('{'); if (s < 0) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = s; i < t.length; i++) { const ch = t[i]; if (esc) { esc = false; continue; } if (ch === '\\' && inStr) { esc = true; continue; } if (ch === '"') { inStr = !inStr; continue; } if (inStr) continue; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } } }
  return end < 0 ? null : (() => { try { return JSON.parse(t.slice(s, end + 1)); } catch { return null; } })();
}

const parseImg = (raw: string) => { const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(raw); return { media: (m?.[1] || 'image/png') as any, data: m?.[2] || raw }; };

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI not configured' }, { status: 200 });

  let body: { imageA?: string; imageB?: string; labelA?: string; labelB?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!body.imageA || !body.imageB) return Response.json({ error: 'Two images required (old + new revision)' }, { status: 400 });
  const a = parseImg(body.imageA), b = parseImg(body.imageB);
  const labelA = body.labelA || 'Revision A (older)', labelB = body.labelB || 'Revision B (newer)';

  const prompt = `Image 1 is "${labelA}". Image 2 is "${labelB}". They are two revisions of the same construction sheet.

Compare them and list EVERY real difference — walls added/removed/moved, doors/windows/fixtures added or removed, rooms re-sized, dimensions changed, schedule/notes changed, revision-cloud areas. Ignore rendering noise; report only genuine design changes. For each, judge the likely cost direction for the trade contractor.

Return ONLY:
{"summary":"one sentence","netScope":"increase|decrease|neutral|unclear",
 "changes":[{"type":"added|removed|moved|modified","trade":"e.g. Openings","description":"what changed","location":"where on the sheet","costImpact":"increase|decrease|neutral|unclear","confidence":0-100}]}`;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 3000, system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'text', text: `IMAGE 1 — ${labelA}:` },
        { type: 'image', source: { type: 'base64', media_type: a.media, data: a.data } },
        { type: 'text', text: `IMAGE 2 — ${labelB}:` },
        { type: 'image', source: { type: 'base64', media_type: b.media, data: b.data } },
        { type: 'text', text: prompt },
      ] }],
    });
    const text = (resp.content || []).filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    const parsed = extractJson(text);
    if (!parsed) return Response.json({ error: 'Could not compare the sheets' }, { status: 200 });
    const changes = (parsed.changes || []).filter((c: any) => c && c.description).map((c: any) => ({
      type: String(c.type || 'modified'), trade: c.trade || '', description: String(c.description),
      location: c.location || '', costImpact: c.costImpact || 'unclear', confidence: c.confidence ?? null,
    }));
    return Response.json({ summary: parsed.summary || '', netScope: parsed.netScope || 'unclear', changes });
  } catch (err: any) {
    console.error('[takeoff/compare-revisions] compare failed:', err);
    return Response.json({ error: 'The revisions could not be compared. Please try again.' }, { status: 200 });
  }
}
