import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import seed from '@/data/trade-knowledge-seed.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * One-time seeder for the global Trade Knowledge Base.
 *
 * Reads data/trade-knowledge-seed.json (bundled at build time) and loads it into
 * the trade_knowledge table as global articles (is_global = true), visible to
 * every tenant. Idempotent: clears existing global rows first, then re-inserts,
 * so re-running always yields the same clean library.
 *
 * Gated by a token so it can't be triggered casually. Trigger:
 *   GET /api/admin/seed-trade-knowledge?token=saguaro-seed-2026
 */
interface SeedArticle {
  trade: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  manufacturer?: string;
  difficulty: string;
  estimated_time: string;
  tools_required: string[];
  materials_required: string[];
  code_references: string[];
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (token !== (process.env.SEED_TOKEN || 'saguaro-seed-2026')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = createServerClient();
    const articles = seed as SeedArticle[];

    // Idempotent: wipe the existing global library so re-runs stay clean.
    await db.from('trade_knowledge').delete().eq('is_global', true);

    const rows = articles.map((x) => ({
      trade: x.trade,
      category: x.category,
      title: x.title,
      content: x.content,
      tags: x.tags || [],
      manufacturer: x.manufacturer || null,
      difficulty: x.difficulty,
      estimated_time: x.estimated_time,
      tools_required: x.tools_required || [],
      materials_required: x.materials_required || [],
      code_references: x.code_references || [],
      is_global: true,
      views: 0,
      helpful_votes: 0,
    }));

    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += 40) {
      const batch = rows.slice(i, i + 40);
      const { error } = await db.from('trade_knowledge').insert(batch);
      if (error) errors.push(`batch ${i}: ${error.message}`);
      else inserted += batch.length;
    }

    // Per-trade summary for verification.
    const byTrade: Record<string, number> = {};
    for (const r of rows) byTrade[r.trade] = (byTrade[r.trade] || 0) + 1;

    return NextResponse.json({
      ok: errors.length === 0,
      total: rows.length,
      inserted,
      byTrade,
      errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Seed failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
