import useSWR from 'swr';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  return r.json();
};

// Current tenant's gated-feature flags. Fail-closed: unknown/loading => not enabled.
export function useEntitlements() {
  const { data, isLoading } = useSWR<{ features: Record<string, boolean>; plan: string | null }>(
    '/api/me/entitlements',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );
  return {
    features: (data?.features ?? {}) as Record<string, boolean>,
    plan: data?.plan ?? null,
    loading: isLoading,
  };
}

// Convenience: is a single feature enabled for this tenant?
export function useFeature(flag: string) {
  const { features, loading } = useEntitlements();
  return { enabled: features[flag] === true, loading };
}
