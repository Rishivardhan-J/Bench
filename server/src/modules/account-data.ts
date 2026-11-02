import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { emit } from '../lib/events.ts';
import { compact, ms } from '../lib/guards.ts';
import { requireAuth, requireRole } from '../lib/session.ts';
import { id as idSchema, parse, text } from '../lib/validate.ts';
import { enforceRateLimit, DAY } from '../lib/rateLimit.ts';

const prefSchema = z.object({ inApp: z.boolean(), email: z.boolean() });
const TYPES = ['new_request', 'request_accepted', 'new_message', 'proposal_received'] as const;

export async function accountDataRoutes(app: FastifyInstance) {
  // Notifications ------------------------------------------------------
  app.get('/api/notifications', async (req) => {
    const user = requireAuth(req);
    const rows = await many(
      pool,
      `SELECT id, type, ref_id AS "refId", title, body, link, read, ${ms('created_at')} AS "createdAt"
       FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id],
    );
    return { notifications: rows.map((r) => compact(r)) };
  });

  app.post('/api/notifications/read', async (req) => {
    const user = requireAuth(req);
    const { ids } = parse(z.object({ ids: z.array(idSchema()).max(200) }), req.body);
    await tx(async (c) => {
      await c.query('UPDATE notifications SET read = true WHERE user_id = $1 AND id = ANY($2)', [user.id, ids]);
      await emit(c, [user.id], ['notifications']);
    });
    return { ok: true };
  });

  app.get('/api/notification-prefs', async (req) => {
    const user = requireAuth(req);
    const row = (await pool.query('SELECT prefs FROM notification_prefs WHERE user_id = $1', [user.id])).rows[0];
    return { prefs: row?.prefs ?? {} };
  });

  app.put('/api/notification-prefs', async (req) => {
    const user = requireAuth(req);
    const prefs = parse(z.object(Object.fromEntries(TYPES.map((t) => [t, prefSchema]))), req.body);
    await tx(async (c) => {
      await c.query(`INSERT INTO notification_prefs (user_id, prefs) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET prefs = $2`, [user.id, JSON.stringify(prefs)]);
      await emit(c, [user.id], ['prefs']);
    });
    return { ok: true };
  });

  // Saved searches ------------------------------------------------------
  const SEARCH_SQL = `SELECT id, label, query, filters, alert_enabled AS "alertEnabled" FROM saved_searches`;

  app.get('/api/saved-searches', async (req) => {
    const user = requireRole(req, 'client');
    const rows = await many(pool, `${SEARCH_SQL} WHERE client_id = $1 ORDER BY created_at DESC LIMIT 50`, [user.id]);
    return { searches: rows.map((r) => ({ ...r, clientUid: user.id })) };
  });

  app.post('/api/saved-searches', async (req) => {
    const user = requireRole(req, 'client');
    const body = parse(
      z.object({
        label: text(80, 'Name'),
        query: z.string().max(2000).default(''),
        filters: z.record(z.string(), z.unknown()).default({}).refine((f) => JSON.stringify(f).length <= 4000, 'Those filters are too large to save.'),
      }),
      req.body,
    );
    await enforceRateLimit(pool, 'save-search', user.id, 50, DAY, 'You have saved many searches today. Try again tomorrow.');
    const count = (await pool.query('SELECT count(*)::int AS n FROM saved_searches WHERE client_id = $1', [user.id])).rows[0].n;
    if (count >= 50) throw new ApiError('failed-precondition', 'You can keep up to 50 saved searches. Delete one to add another.');
    await tx(async (c) => {
      await c.query('INSERT INTO saved_searches (client_id, label, query, filters) VALUES ($1, $2, $3, $4)', [user.id, body.label, body.query, JSON.stringify(body.filters)]);
      await emit(c, [user.id], ['saved-searches']);
    });
    return { ok: true };
  });

  app.patch('/api/saved-searches/:id', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const { alertEnabled } = parse(z.object({ alertEnabled: z.boolean() }), req.body);
    await tx(async (c) => {
      const res = await c.query('UPDATE saved_searches SET alert_enabled = $3 WHERE id = $1 AND client_id = $2', [id, user.id, alertEnabled]);
      if (res.rowCount === 0) throw new ApiError('not-found', 'Saved search not found.');
      await emit(c, [user.id], ['saved-searches']);
    });
    return { ok: true };
  });

  app.delete('/api/saved-searches/:id', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await tx(async (c) => {
      await c.query('DELETE FROM saved_searches WHERE id = $1 AND client_id = $2', [id, user.id]);
      await emit(c, [user.id], ['saved-searches']);
    });
    return { ok: true };
  });
}
