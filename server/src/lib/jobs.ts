import { config } from '../config.ts';
import { pool, tx } from '../db/client.ts';
import { emit } from './events.ts';
import { flushOutbox } from './mailer.ts';
import { notify } from './notify.ts';

/** A request nobody answers for this long is closed, so the client is not left waiting. */
export const REQUEST_EXPIRY_DAYS = 5;

export async function expireStaleRequests(): Promise<number> {
  return tx(async (c) => {
    const rows = (
      await c.query(
        `UPDATE connections SET status = 'expired'
         WHERE status = 'pending' AND created_at < now() - ($1 * interval '1 day')
         RETURNING id, client_id, freelancer_id`,
        [REQUEST_EXPIRY_DAYS],
      )
    ).rows;
    for (const r of rows) {
      const name = (await c.query('SELECT name FROM freelancer_profiles WHERE user_id = $1', [r.freelancer_id])).rows[0]?.name || 'The freelancer';
      await notify(c, r.client_id, {
        type: 'request_expired',
        title: `${name} didn't reply in time`,
        body: 'Your request has closed. You can try someone else or send it again.',
        link: '/',
        refId: r.id,
      });
      await emit(c, [r.client_id, r.freelancer_id], ['connections']);
    }
    return rows.length;
  });
}

async function housekeeping() {
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  await pool.query(`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`);
  await pool.query(`DELETE FROM password_resets WHERE expires_at < now() - interval '1 day'`);
  await pool.query(`DELETE FROM profile_viewers WHERE day < current_date - 2`);
  await pool.query(`DELETE FROM mail_outbox WHERE sent_at < now() - interval '30 days'`);
}

export function startJobs(): () => void {
  if (config.isTest) return () => undefined;
  const run = (name: string, fn: () => Promise<unknown>) => () => void fn().catch((error) => console.error(`[job:${name}]`, error));
  const timers = [
    setInterval(run('mail', flushOutbox), 15_000),
    setInterval(run('expire', expireStaleRequests), 10 * 60_000),
    setInterval(run('housekeeping', housekeeping), 60 * 60_000),
  ];
  timers.forEach((t) => t.unref());
  run('expire', expireStaleRequests)();
  return () => timers.forEach(clearInterval);
}
