'use client';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
};

/**
 * THE shared client cache for the project intelligence snapshot
 * (/api/project-context — the 14-query aggregate every SmartCreate screen
 * seeds from). One SWR key per project: module hops render the cached
 * snapshot instantly and revalidate in the background (speed contract W-3).
 *
 * Drop-in for the raw-fetch pattern:
 *   const { ctx } = useProjectContext(projectId);   // ctx shape unchanged
 */
export function useProjectContext(projectId: string | null | undefined) {
  const { data, error, isLoading, mutate: revalidate } = useSWR<any>(
    projectId ? `/api/project-context?projectId=${projectId}` : null,
    fetcher,
    { dedupingInterval: 30_000, keepPreviousData: true, revalidateOnFocus: false }
  );

  return {
    ctx: data && !data.error ? data : null,
    loading: isLoading,
    error: error || (data?.error ? new Error(String(data.error)) : null),
    revalidate,
  };
}
