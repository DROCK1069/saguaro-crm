/**
 * Win/Loss learning orchestrator — mirrors lib/takeoff-learn.ts::learnTenantRates.
 *
 * Reads a tenant's bid_outcome_lines (won/lost, per CSI division), runs the pure
 * deterministic engine (lib/winloss/factors), and upserts trade_win_factors keyed
 * by (tenant_id, csi_division).
 *
 * Pass a SERVICE-ROLE supabase client. The CALLER owns auth; `tenantId` MUST be
 * derived from the authenticated user (never client input) — every read/write here
 * is explicitly tenant-scoped because service-role bypasses RLS.
 */
import { learnWinFactors } from '@/lib/winloss/factors';
import type { OutcomeLine } from '@/lib/winloss/types';

export interface BidLearnResult {
  divisions: number;   // how many CSI divisions got a factor
  fromLines: number;   // outcome lines consulted
  message?: string;
  factors?: { csi_division: string; multiplier: number; confidence: number; samples: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function learnTenantWinFactors(supabase: any, tenantId: string): Promise<BidLearnResult> {
  if (!tenantId) return { divisions: 0, fromLines: 0, message: 'No tenant.' };

  const { data: rows, error } = await supabase
    .from('bid_outcome_lines')
    .select('csi_division,trade,our_cost_cents,our_sell_cents,winning_sell_cents,outcome')
    .eq('tenant_id', tenantId)
    .limit(50000);
  if (error) throw new Error(error.message);

  const lines: OutcomeLine[] = (rows || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      csiDivision:      String(r.csi_division || ''),
      trade:            r.trade ?? null,
      ourCostCents:     r.our_cost_cents == null ? null : Number(r.our_cost_cents),
      ourSellCents:     r.our_sell_cents == null ? null : Number(r.our_sell_cents),
      winningSellCents: r.winning_sell_cents == null ? null : Number(r.winning_sell_cents),
      outcome:          r.outcome === 'won' ? 'won' : 'lost',
    }));

  if (!lines.length) {
    return { divisions: 0, fromLines: 0, message: 'No bid outcomes recorded yet — mark a bid Won or Lost first.' };
  }

  const factors = learnWinFactors(lines);
  const nowIso = new Date().toISOString();

  const upsertRows = factors.map((f) => ({
    tenant_id:            tenantId,
    csi_division:         f.csiDivision,
    trade:               f.trade,
    win_count:            f.winCount,
    loss_count:           f.lossCount,
    win_rate:             f.winRate,
    avg_win_margin_pct:   f.avgWinMarginPct,
    avg_loss_margin_pct:  f.avgLossMarginPct,
    avg_over_winner_pct:  f.avgOverWinnerPct,
    suggested_multiplier: f.suggestedMultiplier,
    confidence:           f.confidence,
    sample_count:         f.sampleCount,
    source:               'learned',
    updated_at:           nowIso,
  }));

  if (upsertRows.length) {
    const { error: upErr } = await supabase
      .from('trade_win_factors')
      .upsert(upsertRows, { onConflict: 'tenant_id,csi_division' });
    if (upErr) throw new Error(upErr.message);
  }

  return {
    divisions: upsertRows.length,
    fromLines: lines.length,
    factors: upsertRows.map((r) => ({
      csi_division: r.csi_division,
      multiplier:   r.suggested_multiplier,
      confidence:   r.confidence,
      samples:      r.sample_count,
    })),
  };
}
