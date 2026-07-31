import { redirect } from 'next/navigation';

/**
 * Deprecated route — consolidated into the canonical /field/rfis screen.
 * Kept as a redirect (not deleted) so existing links / bookmarks still resolve.
 */
export default function DeprecatedRfiRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') params.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
  }
  const qs = params.toString();
  redirect(`/field/rfis${qs ? `?${qs}` : ''}`);
}
