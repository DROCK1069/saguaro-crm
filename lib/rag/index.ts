/**
 * RAG retrieval core — deterministic, DOM-free keyword re-ranker (BM25-lite).
 * Shared AS-IS by web + iOS. The Sage "ask your project docs" route pulls candidate
 * records from Postgres (FTS/ILIKE), turns them into DocChunks, and this ranks them
 * so Claude answers from the few most-relevant sources (with citations). Provable
 * without a DB — mirrors lib/finance / lib/takeoff / lib/bidleveling.
 */

export interface DocChunk {
  id: string;
  source: string;      // human label, e.g. "RFI #12" / "Spec 09 30 00 — Tiling"
  sourceType: string;  // 'rfi' | 'spec' | 'submittal' | 'daily_log' | ...
  recordId?: string;
  route?: string;      // deep-link the client can open
  text: string;
  date?: string;
}
export interface ScoredChunk extends DocChunk { score: number; matchedTerms: string[]; }

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'with', 'at', 'by', 'it', 'its', 'this', 'that', 'as', 'from', 'we', 'you', 'i', 'did', 'do', 'does', 'what', 'which', 'who', 'when', 'where', 'how', 'why', 'our', 'their', 'there', 'has', 'have', 'had', 'will', 'would', 'can', 'could', 'should', 'about', 'any', 'all', 'get', 'got']);

export function terms(q: string): string[] { return (String(q || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []).filter((t) => t.length > 2 && !STOP.has(t)); }
function countMap(ts: string[]): Record<string, number> { const m: Record<string, number> = {}; for (const t of ts) m[t] = (m[t] || 0) + 1; return m; }

/**
 * Rank chunks against a natural-language query. Score = Σ over query terms present
 * of tf·idf, scaled by query-term coverage, plus a phrase (bigram) bonus. Deterministic.
 */
export function rankChunks(query: string, chunks: DocChunk[], topK = 8): ScoredChunk[] {
  const qt = terms(query);
  if (!qt.length || !chunks.length) return [];
  const qset = new Set(qt);
  const N = chunks.length;
  const prepared = chunks.map((c) => { const ts = terms(c.text); const set = new Set(ts); return { c, counts: countMap(ts), set }; });
  const df: Record<string, number> = {};
  for (const t of qset) { let d = 0; for (const p of prepared) if (p.set.has(t)) d++; df[t] = d; }

  const scored: ScoredChunk[] = prepared.map(({ c, counts, set }) => {
    let score = 0; const matched: string[] = [];
    for (const t of qt) {
      if (!set.has(t)) continue;
      const tf = counts[t] || 0;
      const idf = Math.log(1 + N / ((df[t] || 0) + 0.5));
      score += (1 + Math.log(tf)) * idf;
      matched.push(t);
    }
    const coverage = matched.length / qt.length;
    score *= 0.5 + coverage; // reward chunks that hit more of the question
    const low = c.text.toLowerCase();
    for (let i = 0; i < qt.length - 1; i++) if (low.includes(qt[i] + ' ' + qt[i + 1])) score += 1.5; // phrase bonus
    return { ...c, score: Math.round(score * 1000) / 1000, matchedTerms: [...new Set(matched)] };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, topK);
}

/** Trim a chunk's text to a window around the first matched term, for a tight context payload. */
export function snippet(text: string, matched: string[], max = 480): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const low = clean.toLowerCase();
  let at = -1;
  for (const m of matched) { const i = low.indexOf(m); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return clean.slice(0, max) + '…';
  const start = Math.max(0, at - Math.floor(max / 3));
  return (start > 0 ? '…' : '') + clean.slice(start, start + max) + (start + max < clean.length ? '…' : '');
}

/** Build the grounded context block + a citation list for the model, from ranked chunks. */
export function buildContext(ranked: ScoredChunk[]): { context: string; citations: { n: number; source: string; sourceType: string; recordId?: string; route?: string }[] } {
  const citations = ranked.map((c, i) => ({ n: i + 1, source: c.source, sourceType: c.sourceType, recordId: c.recordId, route: c.route }));
  const context = ranked.map((c, i) => `[${i + 1}] (${c.source}${c.date ? ', ' + c.date : ''})\n${snippet(c.text, c.matchedTerms)}`).join('\n\n');
  return { context, citations };
}
