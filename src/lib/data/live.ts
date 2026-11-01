import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import type { DocumentReference, DocumentSnapshot, Query, QueryDocumentSnapshot } from 'firebase/firestore';

export interface LiveState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribes to a query. `key` identifies the query: pass null to stay idle (e.g. signed out),
 * and change it whenever the query changes. `build` and `map` are only read when the key changes.
 */
export function useLiveCollection<T>(
  key: string | null,
  build: () => Query | null,
  map: (d: QueryDocumentSnapshot) => T,
): LiveState<T[]> {
  const [state, setState] = useState<LiveState<T[]>>({ data: [], loading: key !== null, error: null });

  useEffect(() => {
    if (key === null) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    const q = build();
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map(map), loading: false, error: null }),
      (error) => {
        console.error('Live query failed', error);
        setState({ data: [], loading: false, error });
      },
    );
    // build and map are intentionally excluded: `key` is the identity of the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export function useLiveDoc<T>(
  key: string | null,
  build: () => DocumentReference | null,
  map: (d: DocumentSnapshot) => T | null,
): LiveState<T | null> {
  const [state, setState] = useState<LiveState<T | null>>({ data: null, loading: key !== null, error: null });

  useEffect(() => {
    if (key === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const ref = build();
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      ref,
      (snap) => setState({ data: snap.exists() ? map(snap) : null, loading: false, error: null }),
      (error) => {
        console.error('Live document failed', error);
        setState({ data: null, loading: false, error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
