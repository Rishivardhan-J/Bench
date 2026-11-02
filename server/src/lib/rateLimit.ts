import { ApiError } from './errors.ts';
import type { Db } from '../db/client.ts';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/**
 * Fixed-window limiter in one atomic upsert, so parallel requests cannot slip past it.
 * Every attempt counts, including ones over the limit.
 */
export async function enforceRateLimit(db: Db, bucket: string, who: string, max: number, windowMs: number, message?: string): Promise<void> {
  const key = `${bucket}:${String(who).replace(/[^a-zA-Z0-9_.:@-]/g, '_').slice(0, 100)}`;
  const { rows } = await db.query(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now() + ($2 * interval '1 millisecond'))
     ON CONFLICT (key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < now() THEN now() + ($2 * interval '1 millisecond') ELSE rate_limits.reset_at END
     RETURNING count`,
    [key, windowMs],
  );
  if (rows[0].count > max) throw new ApiError('resource-exhausted', message ?? "You've hit the limit for now. Try again in a bit.");
}
