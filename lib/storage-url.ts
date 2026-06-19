import type { SupabaseClient } from '@supabase/supabase-js';

// Storage buckets in this project are PRIVATE (a deliberate security posture — see the
// security-hardening wave that made `documents` private). `getPublicUrl` returns a URL
// that 400s for private buckets, so uploaded photos/drawings/PDFs never display.
// Generate a long-lived SIGNED URL instead — keeps the bucket private but yields a
// working link. Falls back to the public URL if signing fails (e.g. a public bucket).
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365 * 10; // ~10 years

export async function signedUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<string> {
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, SIGNED_TTL_SECONDS);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through to public URL */
  }
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || '';
}
