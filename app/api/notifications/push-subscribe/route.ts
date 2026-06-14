import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/push-subscribe
 * Registers a Web Push subscription for the authenticated user.
 * Called by app/field/more/notifications/page.tsx after the browser grants
 * Notification permission and creates a PushSubscription.
 *
 * Request body: { subscription: PushSubscriptionJSON, userId: string }
 *   - subscription.endpoint is used as the unique token.
 * Response: { success: true }
 *
 * Stored in push_tokens (columns: id, user_id, token, platform, created_at).
 * There is no DB-level unique constraint on `token`, so we de-dupe manually
 * (check-then-insert) instead of relying on upsert/onConflict.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { subscription } = body as {
      subscription?: { endpoint?: string };
      userId?: string;
    };

    const token = subscription?.endpoint;
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'subscription.endpoint is required' },
        { status: 400 },
      );
    }

    const db = createServerClient();

    // De-dupe by token (no unique index exists, so look it up first).
    const { data: existing } = await db
      .from('push_tokens')
      .select('id')
      .eq('token', token)
      .maybeSingle();

    if (existing?.id) {
      // Re-point an existing endpoint at the current user.
      const { error } = await db
        .from('push_tokens')
        .update({ user_id: user.id, platform: 'web' })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await db.from('push_tokens').insert({
        user_id: user.id,
        token,
        platform: 'web',
      });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
