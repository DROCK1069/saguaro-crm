/**
 * Spec-aware cross-check — the edge no takeoff tool has. Takes the estimator's COUNTED
 * quantities and asks Claude to find the SCHEDULED quantity for each in the project's
 * documents (submittals, RFIs, spec sections, correspondence, meeting notes…), then flags
 * mismatches ("you counted 12 doors, the door schedule referenced in Submittal #7 says 14").
 * Reuses the Sage RAG doc-pull + ranker. Tenant-gated. Honest when nothing is on file.
 * Body: { projectId, items: [{ label, count, unit? }] }
 */
import { NextRequest } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions';
import { rankChunks, buildContext, type DocChunk } from '@/lib/rag';

export const runtime = 'nodejs';
export const maxDuration = 60;
/* eslint-disable @typescript-eslint/no-explicit-any */

const SOURCES: { table: string; type: string; cols: string[]; label: (r: any) => string; route: string }[] = [
  { table: 'submittals', type: 'submittal', cols: ['title', 'notes', 'spec_section', 'trade'], label: (r) => `Submittal${r.submittal_number ? ' #' + r.submittal_number : ''}${r.title ? ' — ' + r.title : ''}`, route: 'submittals' },
  { table: 'rfis', type: 'rfi', cols: ['title', 'description', 'response', 'specification_section', 'drawing_reference'], label: (r) => `RFI${r.number ? ' #' + r.number : ''}${r.title ? ' — ' + r.title : ''}`, route: 'rfis' },
  { table: 'correspondence', type: 'correspondence', cols: ['subject', 'body', 'transmittal_remarks'], label: (r) => r.subject || 'Correspondence', route: 'correspondence' },
  { table: 'meetings', type: 'meeting', cols: ['title', 'notes'], label: (r) => `Meeting — ${r.title || ''}`, route: 'meetings' },
  { table: 'change_orders', type: 'change_order', cols: ['title', 'description'], label: (r) => `Change Order${r.co_number ? ' #' + r.co_number : ''}${r.title ? ' — ' + r.title : ''}`, route: 'change-orders' },
  { table: 'observations', type: 'observation', cols: ['description', 'location', 'category', 'trade'], label: (r) => `Observation${r.category ? ' — ' + r.category : ''}`, route: 'observations' },
];

const wordsOf = (s: string) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2);

export async function POST(req: NextRequest) {
  const g = await requirePermission(req, 'Projects', 'Edit');
  if (!g.ok) return g.res;
  const user = g.user;
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'AI not configured' }, { status: 200 });

  let body: { projectId?: string; items?: { label: string; count: number; unit?: string }[] };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }
  const projectId = body.projectId;
  const items = (body.items || []).filter((i) => i && i.label && Number.isFinite(i.count));
  if (!projectId) return Response.json({ error: 'Pick a project' }, { status: 400 });
  if (!items.length) return Response.json({ error: 'No counted items to check' }, { status: 400 });

  const supabase = createServerClient();
  const { data: proj } = await supabase.from('projects').select('id, name, tenant_id').eq('id', projectId).maybeSingle();
  if (!proj || (proj as any).tenant_id !== user.tenantId) return Response.json({ error: 'Project not found' }, { status: 404 });

  // search terms = the item labels + schedule/count vocabulary
  const qterms = [...new Set([...items.flatMap((i) => wordsOf(i.label)), 'schedule', 'quantity', 'count', 'total', 'each'])].slice(0, 14);

  async function fetchTable(src: typeof SOURCES[number]): Promise<any[]> {
    const orAll = qterms.flatMap((t) => src.cols.map((c) => `${c}.ilike.%${t}%`)).join(',');
    try { const { data, error } = await supabase.from(src.table as any).select('*').eq('project_id', projectId).or(orAll).limit(8); if (error) throw error; return data || []; }
    catch { return []; }
  }

  const rows = await Promise.all(SOURCES.map(async (src) => ({ src, data: await fetchTable(src) })));
  const chunks: DocChunk[] = [];
  for (const { src, data } of rows) for (const rec of data) {
    const text = src.cols.map((c) => rec[c]).filter((v) => v != null && String(v).trim()).map((v) => String(v)).join(' — ');
    if (!text.trim()) continue;
    chunks.push({ id: `${src.type}:${rec.id}`, source: src.label(rec).trim(), sourceType: src.type, recordId: String(rec.id || ''), route: `/app/projects/${projectId}/${src.route}`, text, date: rec.created_at || undefined });
  }

  if (!chunks.length) {
    return Response.json({ ok: true, results: items.map((i) => ({ label: i.label, counted: i.count, scheduled: null, source: null, status: 'not_found' })), searched: 0, note: `No schedules or quantity references are on file for ${(proj as any).name || 'this project'} yet — log the schedule (submittal/RFI) to enable the cross-check.` });
  }

  const ranked = rankChunks(items.map((i) => i.label).join(' ') + ' schedule quantity count', chunks, 8);
  const { context, citations } = buildContext(ranked.length ? ranked : []);

  const system = `You are a construction estimator's QA assistant. You are given (A) the estimator's COUNTED quantities from a takeoff, and (B) numbered project documents that MAY contain scheduled quantities (door/window/fixture schedules, spec counts, submittal quantities).
For EACH counted item, find the SCHEDULED quantity in the documents. Compare. Return ONLY raw JSON, no markdown:
{"results":[{"label":"...","counted":N,"scheduled":N_or_null,"sourceN":citation_number_or_null,"status":"match|mismatch|not_found","note":"one short clause"}]}
Rules: status "match" if counted==scheduled, "mismatch" if both known and differ, "not_found" if the docs don't state a scheduled quantity for that item. NEVER invent a scheduled number — only report one you can point to a document for. Keep notes terse.`;

  const userMsg = `COUNTED QUANTITIES:\n${items.map((i) => `- ${i.label}: ${i.count}${i.unit ? ' ' + i.unit : ''}`).join('\n')}\n\nPROJECT DOCUMENTS:\n${context || '(none matched)'}`;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, system, messages: [{ role: 'user', content: userMsg }] });
    const raw = (resp.content || []).filter((x: any) => x.type === 'text').map((x: any) => x.text).join('').trim();
    const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
    let parsed: any = null;
    try { parsed = start >= 0 ? JSON.parse(raw.slice(start, end + 1)) : null; } catch { parsed = null; }
    const results = Array.isArray(parsed?.results) ? parsed.results : items.map((i) => ({ label: i.label, counted: i.count, scheduled: null, status: 'not_found' }));
    // attach the citation object for any sourceN
    const withSrc = results.map((r: any) => ({ ...r, source: r.sourceN ? citations.find((c) => c.n === r.sourceN) || null : null }));
    return Response.json({ ok: true, results: withSrc, citations, searched: chunks.length });
  } catch (err: any) {
    console.error('[takeoff/spec-check] spec check failed:', err);
    return Response.json({ error: 'The spec cross-check could not be completed. Please try again.' }, { status: 200 });
  }
}
