import { createServerClient } from '@/lib/supabase-server';

const PUBLIC_MARKER = '/storage/v1/object/public/';

/**
 * Derive the bucket-relative object path from a stored value. Handles:
 *  - a Supabase PUBLIC url (legacy rows): ".../object/public/<bucket>/<path>"
 *  - a bare path already (forward-compatible)
 * Returns null for values we can't sign (demo://, foreign URLs).
 */
export function pathFromStored(stored: string | null | undefined, bucket: string): string | null {
  if (!stored) return null;
  const i = stored.indexOf(PUBLIC_MARKER);
  if (i >= 0) {
    const after = stored.slice(i + PUBLIC_MARKER.length); // "<bucket>/<path>"
    const slash = after.indexOf('/');
    if (slash >= 0) return after.slice(slash + 1);
    return after;
  }
  if (stored.startsWith('http') || stored.startsWith('demo://') || stored.startsWith('blob:')) return null;
  return stored; // already a path
}

/**
 * Return a short-lived signed URL for a private-bucket object, given either a
 * legacy public URL or a path. Falls back to the original value if it can't be
 * signed (so demo/foreign URLs still pass through). Centralizes the
 * public-bucket -> signed-URL migration.
 */
export async function signStoredUrl(
  bucket: string,
  stored: string | null | undefined,
  ttlSeconds = 3600,
): Promise<string> {
  const path = pathFromStored(stored, bucket);
  if (!path) return stored ?? '';
  try {
    const { data, error } = await createServerClient().storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) return stored ?? '';
    return data.signedUrl;
  } catch {
    return stored ?? '';
  }
}
