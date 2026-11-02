import type { Db } from '../db/client.ts';

/**
 * Tells connected browsers that something changed. Uses pg_notify inside the caller's
 * transaction, so listeners hear about it only after the data is committed.
 * `users: '*'` reaches everyone signed in (public data such as open projects).
 */
export async function emit(db: Db, users: string[] | '*', scopes: string[]): Promise<void> {
  if (users !== '*' && users.length === 0) return;
  await db.query(`SELECT pg_notify('bench_events', $1)`, [JSON.stringify({ users, scopes })]);
}
