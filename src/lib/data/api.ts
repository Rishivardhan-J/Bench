import { httpsCallable } from 'firebase/functions';
import type { Timestamp } from 'firebase/firestore';
import { functions } from '@/lib/firebase';

/** Typed wrapper around a callable Cloud Function. */
export function callable<TIn, TOut>(name: string) {
  const fn = httpsCallable<TIn, TOut>(functions, name);
  return async (data: TIn): Promise<TOut> => (await fn(data)).data;
}

/** Turns a callable/Firestore failure into a sentence worth showing. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as { code?: string; message?: string } | undefined;
  if (!e) return fallback;
  if (e.code === 'functions/unauthenticated') return 'Please sign in to continue.';
  if (e.code === 'functions/unavailable' || e.code === 'functions/internal' || e.code === 'functions/deadline-exceeded') {
    return fallback;
  }
  if (e.code === 'permission-denied') return "You don't have permission to do that.";
  // HttpsError messages from our functions are written for people.
  if (e.code?.startsWith('functions/') && e.message) return e.message;
  return fallback;
}

export function isRateLimited(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === 'functions/resource-exhausted';
}

/** Firestore Timestamp (or already-numeric) to epoch milliseconds. */
export function toMillis(value: unknown): number | undefined {
  if (!value) return undefined;
  if (typeof value === 'number') return value;
  const ts = value as Timestamp;
  return typeof ts.toMillis === 'function' ? ts.toMillis() : undefined;
}
