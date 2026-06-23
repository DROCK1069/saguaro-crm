import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { levelBids } from '@/lib/bid-leveling';

export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/projects/[projectId]/bid-packages/[id]/bids
 * Returns a BidComparison the field page renders directly:
 *   { line_items, bidders[], recommended_bidder_id }
 * Runs the bid-leveling engine so `recommended_bidder_id` and per-bidder
 * scores/variance come back ranked. (Previously this ordered by a
 * non-existent `total_amount` column and returned the wrong shape, so the
 * comparison/leveling view was always empty.)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data, error } = await db.from('bids').select('*')
    .eq('bid_package_id', id).eq('tenant_id', user.tenantId)
    .order('amount', { ascending: true });
  if (error) return NextResponse.json({ line_items: [], bidders: [], error: error.message }, { status: 500 });

  const bids = data || [];
  const leveled = levelBids(bids);
  const byCompany = new Map(leveled.bids.map((b) => [b.bidder_company, b]));

  const bidders = bids.map((b: any) => {
    const lv = byCompany.get(b.bidder_company);
    return {
      bidder_id: b.id,
      company_name: b.bidder_company || b.bidder_name || 'Unknown',
      line_items: [],
      total: Number(b.amount) || 0,
      notes: b.notes || '',
      submitted_at: b.submitted_at || null,
      qualifications: b.inclusions ? String(b.inclusions).split(/[;\n]/).map((s) => s.trim()).filter(Boolean) : [],
      exclusions: b.exclusions ? String(b.exclusions).split(/[;\n]/).map((s) => s.trim()).filter(Boolean) : [],
      bond_included: !!b.bond_included,
      composite_score: lv?.composite_score ?? null,
      rank: lv?.rank ?? null,
      variance_pct: lv?.variance_pct ?? null,
    };
  });

  const recommended = leveled.bids[0];
  const recommendedBid = recommended ? bids.find((b: any) => b.bidder_company === recommended.bidder_company) : null;

  return NextResponse.json({
    line_items: [],
    bidders,
    recommended_bidder_id: recommendedBid?.id || null,
    summary: {
      low_bid: leveled.low_bid,
      recommended: leveled.recommended,
      spread: leveled.spread,
      spread_pct: leveled.spread_pct,
      avg_amount: leveled.avg_amount,
      median_amount: leveled.median_amount,
    },
  });
}

/**
 * POST — add a bid to the package. (Was missing, so the field page's
 * "add bidder/bid" action silently failed.)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = createServerClient() as any;
  const { data, error } = await db.from('bids').insert({
    tenant_id: user.tenantId,
    project_id: projectId,
    bid_package_id: id,
    bidder_name: body.bidder_name || body.company_name || null,
    bidder_company: body.bidder_company || body.company_name || null,
    bidder_email: body.bidder_email || body.email || null,
    bidder_phone: body.bidder_phone || body.phone || null,
    trade: body.trade || null,
    amount: body.amount ?? body.total ?? 0,
    alternate_amounts: body.alternate_amounts || {},
    inclusions: typeof body.inclusions === 'string' ? body.inclusions
      : Array.isArray(body.qualifications) ? body.qualifications.join('; ')
      : Array.isArray(body.inclusions) ? body.inclusions.join('; ') : null,
    exclusions: typeof body.exclusions === 'string' ? body.exclusions
      : Array.isArray(body.exclusions) ? body.exclusions.join('; ') : null,
    bond_included: !!body.bond_included,
    status: body.status || 'submitted',
    notes: body.notes || null,
    submitted_at: body.submitted_at || new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bid: data }, { status: 201 });
}
