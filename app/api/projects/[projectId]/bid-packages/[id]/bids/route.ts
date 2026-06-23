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
    if (error) return NextResponse.json({ bids: [] });
    return NextResponse.json({ bids: data || [] });
  } catch {
    return NextResponse.json({ bids: [] });
  }
}
