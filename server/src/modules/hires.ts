import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { emit } from '../lib/events.ts';
import { compact, ms } from '../lib/guards.ts';
import { notify } from '../lib/notify.ts';
import { requireRole } from '../lib/session.ts';
import { firstNameInitial, id as idSchema, optText, parse, text } from '../lib/validate.ts';

const reviewSql = `SELECT id, hire_id AS "hireId", client_id AS "clientUid", freelancer_id AS "freelancerUid", client_name AS "clientName",
  rating, text, reply, ${ms('created_at')} AS "createdAt" FROM reviews`;

export async function hireRoutes(app: FastifyInstance) {
  app.get('/api/hires', async (req) => {
    const user = requireRole(req, 'client');
    const rows = await many(pool, `SELECT id, freelancer_id AS "freelancerUid", project_id AS "projectId" FROM hires WHERE client_id = $1 LIMIT 200`, [user.id]);
    return { hires: rows.map((r) => compact(r)) };
  });

  app.post('/api/hires', async (req) => {
    const client = requireRole(req, 'client');
    const body = parse(z.object({ freelancerUid: idSchema('Freelancer'), projectId: optText(128) }), req.body);
    return tx(async (c) => {
      const conn = await one<{ status: string; thread_id: string | null }>(c, 'SELECT status, thread_id FROM connections WHERE client_id = $1 AND freelancer_id = $2', [client.id, body.freelancerUid]);
      if (!conn || conn.status !== 'accepted') throw new ApiError('failed-precondition', 'You can mark a hire once a request has been accepted.');
      const inserted = await one<{ id: string }>(
        c,
        `INSERT INTO hires (client_id, freelancer_id, project_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
        [client.id, body.freelancerUid, body.projectId ?? null],
      );
      const hire = inserted ?? (await one<{ id: string }>(c, `SELECT id FROM hires WHERE client_id = $1 AND freelancer_id = $2 AND coalesce(project_id, '') = $3`, [client.id, body.freelancerUid, body.projectId ?? '']))!;
      if (inserted && conn.thread_id) await c.query('UPDATE threads SET hire_id = $2 WHERE id = $1', [conn.thread_id, hire.id]);
      await emit(c, [client.id, body.freelancerUid], ['hires', 'threads']);
      return { hireId: hire.id };
    });
  });

  app.get('/api/reviews/:id', async (req) => {
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const row = await one(pool, `${reviewSql} WHERE id = $1`, [id]);
    return { review: row ? compact(row) : null };
  });

  app.post('/api/reviews', async (req) => {
    const client = requireRole(req, 'client');
    const body = parse(
      z.object({
        hireId: idSchema('hireId'),
        rating: z.number({ error: 'Rating must be 1 to 5.' }).int('Rating must be 1 to 5.').min(1, 'Rating must be 1 to 5.').max(5, 'Rating must be 1 to 5.'),
        text: text(1500, 'Review').refine((t) => t.length >= 10, 'Please write at least a sentence.'),
      }),
      req.body,
    );
    return tx(async (c) => {
      const hire = await one<{ freelancer_id: string }>(c, 'SELECT freelancer_id FROM hires WHERE id = $1 AND client_id = $2', [body.hireId, client.id]);
      if (!hire) throw new ApiError('not-found', 'Hire not found.');

      // Only after a real two-sided conversation. The thread is found through the connection, never guessed.
      const counts = (
        await c.query(
          `SELECT count(*) FILTER (WHERE m.sender_id = $1) AS from_client, count(*) FILTER (WHERE m.sender_id = $2) AS from_freelancer
           FROM connections cn JOIN messages m ON m.thread_id = cn.thread_id WHERE cn.client_id = $1 AND cn.freelancer_id = $2`,
          [client.id, hire.freelancer_id],
        )
      ).rows[0];
      if (counts.from_client < 2 || counts.from_freelancer < 1) {
        throw new ApiError('failed-precondition', "Reviews open up after you've had a conversation with this freelancer.");
      }

      const name = (await one<{ name: string }>(c, 'SELECT name FROM client_profiles WHERE user_id = $1', [client.id]))?.name;
      const inserted = await c.query(
        `INSERT INTO reviews (id, hire_id, client_id, client_name, freelancer_id, rating, text) VALUES ($1, $1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [body.hireId, client.id, firstNameInitial(name), hire.freelancer_id, body.rating, body.text],
      );
      if (inserted.rowCount === 0) throw new ApiError('already-exists', "You've already reviewed this engagement.");

      // Ratings are recomputed in the same transaction, so a review and its average never disagree.
      await c.query(
        `UPDATE freelancer_profiles SET
           rating_avg = (SELECT round(avg(rating), 1) FROM reviews WHERE freelancer_id = $1),
           review_count = (SELECT count(*) FROM reviews WHERE freelancer_id = $1)
         WHERE user_id = $1`,
        [hire.freelancer_id],
      );
      await notify(c, hire.freelancer_id, { type: 'new_review', title: 'You received a new review', body: `${body.rating} out of 5 from ${firstNameInitial(name)}`, link: '/freelancer/status' });
      await emit(c, '*', [`reviews:${hire.freelancer_id}`]);
      await emit(c, [client.id, hire.freelancer_id], ['profile']);
      return { reviewId: body.hireId };
    });
  });

  app.post('/api/reviews/:id/reply', async (req) => {
    const user = requireRole(req, 'freelancer');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const { text: reply } = parse(z.object({ text: text(800, 'Reply') }), req.body);
    await tx(async (c) => {
      const row = await one<{ reply: string | null }>(c, 'SELECT reply FROM reviews WHERE id = $1 AND freelancer_id = $2 FOR UPDATE', [id, user.id]);
      if (!row) throw new ApiError('not-found', 'Review not found.');
      if (row.reply) throw new ApiError('already-exists', "You've already replied to this review.");
      await c.query('UPDATE reviews SET reply = $2, replied_at = now() WHERE id = $1', [id, reply]);
      await emit(c, '*', [`reviews:${user.id}`]);
    });
    return { replied: true };
  });
}
