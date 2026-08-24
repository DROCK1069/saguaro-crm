import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUser } from '@/lib/supabase-server';
import { signFields } from '@/lib/storage-signing';

/**
 * Photos for ONE project.
 *
 * `projectId` is REQUIRED. It used to be optional, and omitting it silently
 * returned every photo in the tenant — which is how a caller that sent the
 * wrong param name (`project_id` instead of `projectId`) ended up showing one
 * job's gallery full of another job's photos. A missing project is now an
 * honest 400 instead of a tenant-wide dump: a filter that silently doesn't
 * filter is worse than an error.
 *
 * `?all=1` is the explicit, deliberate opt-in for a genuinely tenant-wide view.
 *
 * THUMBNAIL CONTRACT (what every grid client must do)
 * Each photo carries BOTH `url` (the full-resolution original — real rows here
 * are 1-3.6 MB, 12-megapixel JPEGs) and `thumbnail_url` (a ~400px JPEG, 12-24 KB
 * in practice). Both are signed for the private bucket before they leave here.
 *
 * A grid MUST render `thumbnail_url` and fall back to `url` only when it is
 * null. Rendering `url` in a tile is what freezes the phone: eighteen 12MP
 * decodes is hundreds of megabytes of bitmap on the UI thread. `url` is for the
 * full-screen viewer, one image at a time.
 *
 * `thumbnail_url` is null on rows the backfill could not process — legacy .heic
 * originals, and the external Unsplash seed rows. That null is honest: it means
 * "no thumbnail exists", not "not signed yet". Handle it, don't assume it.
 * Backfill: scripts/backfill-photo-thumbs.ts
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', photos: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  // Accept the snake_case spelling too — several callers send it, and honoring
  // it is better than pretending they asked for everything.
  const projectId = searchParams.get('projectId') || searchParams.get('project_id');
  const wantsAll = searchParams.get('all') === '1';

  if (!projectId && !wantsAll) {
    return NextResponse.json(
      { error: 'projectId is required (pass ?all=1 to deliberately list every project)', photos: [] },
      { status: 400 },
    );
  }

  try {
    const db = createServerClient();
    let query = db
      .from('photos')
      .select('*')
      .eq('tenant_id', user.tenantId)
      .order('taken_at', { ascending: false })
      .limit(1000);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    // 'project-files' bucket is private — sign photo URLs on read. signFields is
    // strict: if an object we were supposed to sign doesn't sign, it throws into
    // the catch below rather than returning URLs that 400 on load.
    return NextResponse.json({ photos: await signFields(data || [], ['url', 'thumbnail_url', 'markup_url']) });
  } catch (e: unknown) {
    // Never a silent empty gallery: say it failed so the UI can show a retry
    // instead of an indistinguishable "no photos yet". A signing failure lands
    // here too — a broken-image grid reads as "the photos are gone".
    console.error('[photos/list] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't load photos", photos: [] }, { status: 500 });
  }
}
