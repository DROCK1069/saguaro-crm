import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { levelBids } from '@/lib/bid-leveling';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/projects/[projectId]/bid-packages/[id]/leveling
 * Runs the bid-leveling engine against all submitted bids for a package.
 * Returns the normalized comparison matrix + recommendation.
 *
 * POST saves the analysis to bid_leveling_analyses for audit trail.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data: bids, error } = await db.from('bids')
    .select('*')
    .eq('bid_package_id', id)
    .eq('tenant_id', user.tenantId)
    .in('status', ['submitted', 'accepted', 'awarded']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bids || bids.length === 0) return NextResponse.json({ error: 'No bids to level' }, { status: 404 });

  const result = levelBids(bids);
  return NextResponse.json({ projectId, bidPackageId: id, ...result });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  const { projectId, id } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient() as any;
  const { data: bids } = await db.from('bids')
    .select('*')
    .eq('bid_package_id', id)
    .eq('tenant_id', user.tenantId)
    .in('status', ['submitted', 'accepted', 'awarded']);

  if (!bids || bids.length === 0) return NextResponse.json({ error: 'No bids to level' }, { status: 404 });

  const result = levelBids(bids);
  const { data, error } = await db.from('bid_leveling_analyses').insert({
    tenant_id: user.tenantId,
    project_id: projectId,
    bid_package_id: id,
    analysis: result,
    recommendation: result.recommended,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ analysis: data, ...result });
}
