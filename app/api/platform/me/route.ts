import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { isPlatformAdmin } from '@/lib/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lets the UI decide whether to surface the Platform Integrations admin.
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ isPlatformAdmin: isPlatformAdmin(user.email) });
}
