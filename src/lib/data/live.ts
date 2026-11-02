import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

export interface LiveState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Data that stays current. `scope` names the kind of change that should refresh it (the server
 * sends scopes over the socket); `rest` narrows the cache key. Pass a null `scope` to stay idle.
 */
export function useLive<T>(scope: string | null, rest: unknown[], fetcher: () => Promise<T>, empty: T): LiveState<T> {
  const query = useQuery({
    queryKey: ['live', scope, ...rest],
    queryFn: fetcher,
    enabled: scope !== null,
    staleTime: 5 * 60_000,
  });
  return { data: query.data ?? empty, loading: scope !== null && query.isLoading, error: query.error as Error | null };
}

/** Opens the realtime socket and refreshes whichever live data the server says changed. */
export function connectLive(queryClient: QueryClient): () => void {
  let socket: WebSocket | null = null;
  let timer: number | undefined;
  let attempt = 0;
  let stopped = false;

  const open = () => {
    if (stopped) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${window.location.host}/api/ws`);
    socket.onopen = () => {
      // Anything could have changed while we were away.
      if (attempt > 0) void queryClient.invalidateQueries({ queryKey: ['live'] });
      attempt = 0;
    };
    socket.onmessage = (event) => {
      try {
        const { scopes } = JSON.parse(event.data) as { scopes: string[] };
        void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'live' && scopes.includes(q.queryKey[1] as string) });
        // An approval or suspension changes who is searchable.
        if (scopes.includes('catalogue')) void queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = (event) => {
      socket = null;
      if (stopped || event.code === 4401) return;
      attempt += 1;
      timer = window.setTimeout(open, Math.min(30_000, 500 * 2 ** attempt));
    };
  };
  open();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    socket?.close();
  };
}

/** Keeps the socket open while someone is signed in. Render it once, inside the query provider. */
export function useLiveConnection(signedIn: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!signedIn) return;
    return connectLive(queryClient);
  }, [signedIn, queryClient]);
}
