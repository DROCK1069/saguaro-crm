import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

/**
 * Sage auto-fill for bid scoring.
 *
 * A GC should not have to re-type what the platform already knows. Given a
 * projectId, this derives every Score-a-Bid input from real records:
 *   - bid value    ← the project's latest takeoff sell price / grand total,
 *                     falling back to the contract value on the project row
 *   - trade/type   ← project CSI divisions / scope / project type
 *   - location     ← project city/state/address
 *   - due / owner  ← project bid dates and owner
 *   - margin       ← the project's target profit %
 *   - win-rate     ← this tenant's decided win rate for the same project type
 *
 * Every field is returned with a `source` so the UI can show provenance and the
 * GC can review/override before scoring. Deterministic — no AI invents numbers.
 */

const num = (...vals: unknown[]): number => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};
const str = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  const db = createServerClient();

  // Load the project (service-role client → scope to tenant explicitly).
  const { data: p, error } = await db
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('tenant_id', user.tenantId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // ── Estimated bid value: prefer a real takeoff sell price, then contract value.
  let estimatedValue = 0;
  let valueSource: string | null = null;

  const { data: to } = await db
    .from('takeoffs')
    .select('sell_price, grand_total, total_cost, updated_at')
    .eq('tenant_id', user.tenantId)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1);
  const t = to?.[0] as Record<string, unknown> | undefined;
  if (t) {
    const v = num(t.sell_price, t.grand_total, t.total_cost);
    if (v > 0) { estimatedValue = v; valueSource = 'takeoff'; }
  }
  if (estimatedValue === 0) {
    const { data: tp } = await db
      .from('takeoff_projects')
      .select('sell_price, total_cost_estimate, total_cost, updated_at')
      .eq('tenant_id', user.tenantId)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const q = tp?.[0] as Record<string, unknown> | undefined;
    if (q) {
      const v = num(q.sell_price, q.total_cost_estimate, q.total_cost);
      if (v > 0) { estimatedValue = v; valueSource = 'takeoff'; }
    }
  }
  if (estimatedValue === 0) {
    const v = num(
      p.contract_value, p.revised_contract_value, p.original_contract_value,
      p.total_contract_amount, p.contract_amount, p.scheduled_value, p.estimated_cost,
    );
    if (v > 0) { estimatedValue = v; valueSource = 'contract value'; }
  }

  const projectType = str(p.project_type, p.type, p.building_type) || 'commercial';
  const location = [p.city, p.state].filter(Boolean).join(', ') || str(p.address, p.county);
  const dueDate = str(p.bid_due_date, p.bid_date) || null;
  const ownerName = str(p.owner_name, p.owner_entity, p.gc_name);

  const divisions = Array.isArray(p.divisions) ? (p.divisions as unknown[]) : [];
  // divisions may be strings or jsonb objects ({code,name}) — coerce safely.
  const firstDiv = divisions
    .map((d) => (typeof d === 'string' ? d : (d && typeof d === 'object' ? String((d as any).name ?? (d as any).title ?? '') : '')))
    .find((s) => s && s.trim() !== '') || '';
  const trade = str(
    firstDiv,
    p.scope_of_work ? String(p.scope_of_work).split(/[.,;\n]/)[0].slice(0, 40) : '',
  ) || projectType;

  const marginPct = num(p.profit_pct, p.overhead_pct);

  // ── Deterministic win-rate hint for the same project type. ─────────────────
  let historyHint = '';
  try {
    const { data: hist } = await db
      .from('bid_history')
      .select('outcome')
      .eq('tenant_id', user.tenantId)
      .eq('project_type', projectType)
      .limit(200);
    const rows = (hist || []) as Array<{ outcome?: string }>;
    const decided = rows.filter((h) => h.outcome === 'won' || h.outcome === 'lost');
    const wins = rows.filter((h) => h.outcome === 'won').length;
    if (decided.length) {
      historyHint = `Your win rate on ${projectType} bids: ${Math.round((wins / decided.length) * 100)}% (${decided.length} decided)`;
    }
  } catch { /* history is a nice-to-have, never block the fill */ }

  // ── GC-facing auto-note (reviewable/editable). ─────────────────────────────
  const noteBits: string[] = [];
  if (p.scope_of_work) noteBits.push(`Scope: ${String(p.scope_of_work).slice(0, 240)}`);
  const sqft = num(p.square_footage, p.sq_footage);
  if (sqft > 0) noteBits.push(`${sqft.toLocaleString()} sq ft`);
  if (p.construction_type) noteBits.push(`${p.construction_type} construction`);
  if (p.prevailing_wage) noteBits.push('Prevailing wage');
  if (p.bonded) noteBits.push('Bonded');
  if (historyHint) noteBits.push(historyHint);

  return NextResponse.json({
    projectId,
    fields: {
      projectName: str(p.name),
      bidAmount: estimatedValue ? String(Math.round(estimatedValue)) : '',
      margin: marginPct ? String(marginPct) : '',
      tradeType: trade,
      projectType,
      location,
      dueDate,
      ownerName,
      notes: noteBits.join(' · '),
    },
    sources: { value: valueSource },
    historyHint,
  });
}
