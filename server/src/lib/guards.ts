import { many, one, type Db } from '../db/client.ts';

/** True when either person has blocked the other. */
export async function isBlockedEitherWay(db: Db, a: string, b: string): Promise<boolean> {
  const row = await one(db, `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [a, b]);
  return row !== null;
}

export const adminIds = async (db: Db) => (await many<{ id: string }>(db, 'SELECT id FROM users WHERE is_admin')).map((r) => r.id);

/** Epoch milliseconds from a timestamptz column. */
export const ms = (col: string) => `(extract(epoch from ${col}) * 1000)::bigint`;

/** Drops null properties so the client's `=== undefined` checks keep working. */
export function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === null) delete obj[k];
  return obj;
}
