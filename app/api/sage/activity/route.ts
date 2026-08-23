import { NextRequest, NextResponse } from 'next/server';
import { getUser, createServerClient } from '@/lib/supabase-server';

/**
 * R18 — Sage activity trail. Every automated action and every rule/profile
 * change is logged; this endpoint feeds the visible trail in Sage's UI.
 * Tolerant of 064_sage_brain.sql not being applied yet (returns empty).
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limitRaw = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  try {
    const db = createServerClient();
    const { data, error } = await (db as any)
      .from('sage_activity_log')
      .select('id, rule_id, actor, action_type, summary, detail, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch {
    // Table not migrated yet — honest empty trail rather than a 500.
    return NextResponse.json({
      entries: [],
      note: 'Activity log storage is not migrated yet (064_sage_brain.sql).',
    });
  }
}
