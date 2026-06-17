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

/**
 * Bucket-auto-detecting signer for READ paths: takes a stored Supabase PUBLIC
 * url, parses "<bucket>/<path>" out of it, and returns a short-lived signed
 * URL. Anything that isn't a recognizable public Supabase URL (already-signed,
 * foreign, demo://, empty) is returned unchanged. Use this to migrate any read
 * site to private buckets without hard-coding the bucket name.
 */
export async function signUrl(stored: string | null | undefined, ttlSeconds = 3600): Promise<string> {
  if (!stored) return stored ?? '';
  const i = stored.indexOf(PUBLIC_MARKER);
  if (i < 0) return stored; // not a public-bucket URL (signed/foreign/path) — leave as-is
  const after = stored.slice(i + PUBLIC_MARKER.length); // "<bucket>/<path>"
  const slash = after.indexOf('/');
  if (slash < 0) return stored;
  const bucket = after.slice(0, slash);
  const path = after.slice(slash + 1);
  try {
    const { data, error } = await createServerClient().storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) return stored;
    return data.signedUrl;
  } catch {
    return stored;
  }
}

/** Map an array of records, signing the given URL field(s) on each. */
export async function signFields<T extends Record<string, any>>(
  rows: T[],
  fields: string[],
  ttlSeconds = 3600,
): Promise<T[]> {
  return Promise.all(
    rows.map(async (r) => {
      const out: Record<string, any> = { ...r };
      for (const f of fields) if (typeof out[f] === 'string') out[f] = await signUrl(out[f], ttlSeconds);
      return out as T;
    }),
  );
}
