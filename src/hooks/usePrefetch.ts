import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchRoute } from '@/components/layout/routes';
import { getProvider, isDemoMode } from '@/lib/providers';

/**
 * Returns a function that warms everything a destination needs: its code chunk and, where the page
 * reads from a known query, its data. Call it on hover, focus or touch so the page opens instantly.
 * Failures are ignored; the page itself handles real errors when it loads.
 */
export function usePrefetch() {
  const queryClient = useQueryClient();
  return React.useCallback(
    (path: string) => {
      prefetchRoute(path);
      const provider = getProvider();
      if (path === '/') {
        void queryClient.prefetchQuery({ queryKey: ['catalogue', isDemoMode()], queryFn: () => provider.search({}), staleTime: 60_000 });
      } else if (/^\/freelancer\/[^/]+$/.test(path) && !/^\/freelancer\/(profile|status|requests|board|analytics)$/.test(path)) {
        const id = path.split('/')[2];
        void queryClient.prefetchQuery({ queryKey: ['freelancer', id], queryFn: () => provider.getById(id) });
      }
    },
    [queryClient],
  );
}
