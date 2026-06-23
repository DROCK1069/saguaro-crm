import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const runtime = 'nodejs';
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/drawings/auto-split/status?jobId=
 * Progress of an async drawing-set split (queued|processing|complete|failed
 * with processed/total pages) so the UI can show a progress bar.
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const jobId = new URL(req.url).searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  try {
    const db = createServerClient() as any;
    const { data: job } = await db.from('drawing_split_jobs').select('*').eq('id', jobId).eq('tenant_id', user.tenantId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const pct = job.total_pages > 0 ? Math.round((job.processed_pages / job.total_pages) * 100) : 0;
    return NextResponse.json({ job, pct });
  } catch (err) {
    console.error('[auto-split/status]', err);
    return NextResponse.json({ error: 'Could not load status' }, { status: 500 });
  }
}
