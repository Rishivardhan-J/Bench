import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one, pool, tx, type Db } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { FREELANCER_COLS, freelancerDto } from '../lib/dto.ts';
import { emit } from '../lib/events.ts';
import { ms } from '../lib/guards.ts';
import { requireRole } from '../lib/session.ts';
import { id as idSchema, parse, text } from '../lib/validate.ts';

const MAX_ITEMS = 200;

async function ownList(db: Db, listId: string, clientId: string) {
  const row = await one(db, 'SELECT id FROM shortlists WHERE id = $1 AND client_id = $2 FOR UPDATE', [listId, clientId]);
  if (!row) throw new ApiError('not-found', 'List not found.');
}

async function addItem(c: Db, listId: string, freelancerId: string) {
  const exists = await one(c, 'SELECT 1 FROM freelancer_profiles WHERE user_id = $1', [freelancerId]);
  if (!exists) throw new ApiError('not-found', 'Freelancer not found.');
  const count = (await one<{ n: number }>(c, 'SELECT count(*) AS n FROM shortlist_items WHERE shortlist_id = $1', [listId]))!.n;
  if (count >= MAX_ITEMS) throw new ApiError('failed-precondition', `A list can hold up to ${MAX_ITEMS} people.`);
  const added = await c.query(
    `INSERT INTO shortlist_items (shortlist_id, freelancer_id, position)
     VALUES ($1, $2, COALESCE((SELECT max(position) + 1 FROM shortlist_items WHERE shortlist_id = $1), 0)) ON CONFLICT DO NOTHING`,
    [listId, freelancerId],
  );
  if (added.rowCount) {
    await c.query(
      `INSERT INTO profile_stats_daily (freelancer_id, day, shortlist_adds) VALUES ($1, current_date, 1)
       ON CONFLICT (freelancer_id, day) DO UPDATE SET shortlist_adds = profile_stats_daily.shortlist_adds + 1`,
      [freelancerId],
    );
  }
}

export async function shortlistRoutes(app: FastifyInstance) {
  app.get('/api/shortlists', async (req) => {
    const user = requireRole(req, 'client');
    const lists = await many<Record<string, unknown>>(
      pool,
      `SELECT s.id, s.name, ${ms('s.created_at')} AS "createdAt",
              (SELECT token FROM shortlist_shares sh WHERE sh.shortlist_id = s.id AND sh.revoked_at IS NULL ORDER BY created_at DESC LIMIT 1) AS "shareToken"
       FROM shortlists s WHERE s.client_id = $1 ORDER BY s.created_at ASC`,
      [user.id],
    );
    const items = await many<{ shortlist_id: string; freelancerId: string; note: string; addedAt: number }>(
      pool,
      `SELECT i.shortlist_id, i.freelancer_id AS "freelancerId", i.note, ${ms('i.added_at')} AS "addedAt"
       FROM shortlist_items i JOIN shortlists s ON s.id = i.shortlist_id WHERE s.client_id = $1 ORDER BY i.position, i.added_at`,
      [user.id],
    );
    return {
      lists: lists.map((l) => ({
        ...l,
        shareToken: l.shareToken ?? undefined,
        items: items.filter((i) => i.shortlist_id === l.id).map(({ shortlist_id: _s, ...rest }) => rest),
      })),
    };
  });

  app.post('/api/shortlists', async (req) => {
    const user = requireRole(req, 'client');
    const body = parse(z.object({ name: text(60, 'Name'), freelancerId: z.string().max(128).optional() }), req.body);
    return tx(async (c) => {
      const id = (await c.query('INSERT INTO shortlists (client_id, name) VALUES ($1, $2) RETURNING id', [user.id, body.name])).rows[0].id as string;
      if (body.freelancerId) await addItem(c, id, body.freelancerId);
      await emit(c, [user.id], ['shortlists']);
      return { id };
    });
  });

  app.patch('/api/shortlists/:id', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const { name } = parse(z.object({ name: text(60, 'Name') }), req.body);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      await c.query('UPDATE shortlists SET name = $2 WHERE id = $1', [id, name]);
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  app.delete('/api/shortlists/:id', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      await c.query('DELETE FROM shortlists WHERE id = $1', [id]);
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  const itemParams = z.object({ id: idSchema(), freelancerId: idSchema() });

  app.put('/api/shortlists/:id/items/:freelancerId', async (req) => {
    const user = requireRole(req, 'client');
    const { id, freelancerId } = parse(itemParams, req.params);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      await addItem(c, id, freelancerId);
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  app.delete('/api/shortlists/:id/items/:freelancerId', async (req) => {
    const user = requireRole(req, 'client');
    const { id, freelancerId } = parse(itemParams, req.params);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      await c.query('DELETE FROM shortlist_items WHERE shortlist_id = $1 AND freelancer_id = $2', [id, freelancerId]);
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  app.patch('/api/shortlists/:id/items/:freelancerId', async (req) => {
    const user = requireRole(req, 'client');
    const { id, freelancerId } = parse(itemParams, req.params);
    const { note } = parse(z.object({ note: z.string().max(500, 'Notes can be up to 500 characters.') }), req.body);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      await c.query('UPDATE shortlist_items SET note = $3 WHERE shortlist_id = $1 AND freelancer_id = $2', [id, freelancerId, note]);
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  app.post('/api/shortlists/:id/move', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const { from, to } = parse(z.object({ from: z.number().int().min(0), to: z.number().int().min(0) }), req.body);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      const order = (await c.query('SELECT freelancer_id FROM shortlist_items WHERE shortlist_id = $1 ORDER BY position, added_at', [id])).rows.map((r) => r.freelancer_id as string);
      if (from >= order.length || to >= order.length) return;
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      await c.query(
        `UPDATE shortlist_items i SET position = o.pos FROM (SELECT unnest($2::text[]) AS fid, generate_series(0, $3) AS pos) o WHERE i.shortlist_id = $1 AND i.freelancer_id = o.fid`,
        [id, order, order.length - 1],
      );
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  // Read-only sharing: an unguessable link, revocable, never including private notes.
  app.post('/api/shortlists/:id/share', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    return tx(async (c) => {
      await ownList(c, id, user.id);
      const existing = await one<{ token: string }>(c, 'SELECT token FROM shortlist_shares WHERE shortlist_id = $1 AND revoked_at IS NULL LIMIT 1', [id]);
      const token = existing?.token ?? crypto.randomBytes(24).toString('base64url');
      if (!existing) await c.query('INSERT INTO shortlist_shares (token, shortlist_id) VALUES ($1, $2)', [token, id]);
      await emit(c, [user.id], ['shortlists']);
      return { token };
    });
  });

  app.delete('/api/shortlists/:id/share', async (req) => {
    const user = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await tx(async (c) => {
      await ownList(c, id, user.id);
      await c.query('UPDATE shortlist_shares SET revoked_at = now() WHERE shortlist_id = $1 AND revoked_at IS NULL', [id]);
      await emit(c, [user.id], ['shortlists']);
    });
    return { ok: true };
  });

  app.get('/api/shared/:token', async (req) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(100) }), req.params);
    const list = await one<{ id: string; name: string }>(
      pool,
      `SELECT s.id, s.name FROM shortlist_shares sh JOIN shortlists s ON s.id = sh.shortlist_id WHERE sh.token = $1 AND sh.revoked_at IS NULL`,
      [token],
    );
    if (!list) throw new ApiError('not-found', 'This link is no longer available.');
    const rows = await many<Record<string, unknown>>(
      pool,
      `SELECT ${FREELANCER_COLS} FROM shortlist_items i JOIN freelancer_profiles p ON p.user_id = i.freelancer_id
       WHERE i.shortlist_id = $1 AND p.approved AND NOT p.paused ORDER BY i.position, i.added_at`,
      [list.id],
    );
    return { name: list.name, freelancers: rows.map((r) => freelancerDto(r)) };
  });
}
