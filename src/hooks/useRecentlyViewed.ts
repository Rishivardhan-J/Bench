import { useCallback, useEffect, useState } from 'react';

const KEY = 'bench.recentlyViewed';
const MAX = 8;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode); recently viewed is a convenience only.
  }
}

/** Remembers the last few profiles a person opened (C13). Stored per browser. */
export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(read()), []);

  const remember = useCallback((id: string) => {
    const next = [id, ...read().filter((x) => x !== id)].slice(0, MAX);
    write(next);
    setIds(next);
  }, []);

  return { ids, remember };
}
