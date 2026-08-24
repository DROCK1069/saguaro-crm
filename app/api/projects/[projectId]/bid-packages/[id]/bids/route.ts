import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export async function GET(req: NextRequest, { params }: { params: { projectId: string; id: string } }) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const supabase = createServerClient();
    // Read the table the vendor bid portal actually writes (bid_submissions), not the orphan
    // `bids` table — portal-submitted bids never showed in the GC's bid list otherwise.
    const { data, error } = await supabase
      .from('bid_submissions')
      .select('*')
      .eq('bid_package_id', params.id)
      .eq('tenant_id', user.tenantId)
      .order('base_amount');
    if (error) {
      console.error('[projects/[projectId]/bid-packages/[id]/bids] read failed:', error.message);
      return NextResponse.json({ error: 'Failed to load bids', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ bids: data || [] });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error('[projects/[projectId]/bid-packages/[id]/bids] read failed:', detail);
    // A failed read must not render as an empty result — return a real
    // status so the UI can show an error state with a retry.
    return NextResponse.json({ error: 'Failed to load bids', detail }, { status: 500 });
  }
}
