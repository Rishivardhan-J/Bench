import { QueryClient } from '@tanstack/react-query';

/** One shared client so plain functions (not only hooks) can update the cache. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
