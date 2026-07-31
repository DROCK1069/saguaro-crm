import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { verifyHeatmapShareToken } from '@/lib/heatmap/share';

export const runtime = 'nodejs';

/** GET /api/heatmap/share/[id]?t=&e=  → public read-only design (token-gated, no auth). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const t = url.searchParams.get('t') || '';
  const e = Number(url.searchParams.get('e') || '0');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heatmap_designs not yet in generated DB types
  const supabase = createServerClient() as any;
  const { data, error } = await supabase
    .from('heatmap_designs')
    .select('id,name,data,coverage_percent,device_count,active_type,updated_at,share_nonce,share_expires_at')
    .eq('id', params.id)
    .single();
  if (error || !data) return Response.json({ error: 'Design not found' }, { status: 404 });

  // Verify the token against the CURRENT nonce (revoke = nonce cleared) and bind the
  // URL's expiry to the one stored on the row (a client can't extend its own link).
  const storedExp = data.share_expires_at ? Date.parse(data.share_expires_at) : 0;
  const valid =
    !!storedExp &&
    e === storedExp &&
    Date.now() <= storedExp &&
    verifyHeatmapShareToken(params.id, data.share_nonce, e, t);
  if (!valid) {
    return Response.json({ error: 'This share link is invalid, expired, or has been revoked.' }, { status: 403 });
  }

  // Never leak the share secret material to the public consumer.
  const { share_nonce: _n, share_expires_at: _x, ...design } = data;
  void _n; void _x;
  return Response.json({ design });
}
