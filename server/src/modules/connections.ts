import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { emit } from '../lib/events.ts';
import { isBlockedEitherWay, ms } from '../lib/guards.ts';
import { notify } from '../lib/notify.ts';
import { DAY, enforceRateLimit } from '../lib/rateLimit.ts';
import { requireAuth, requireRole } from '../lib/session.ts';
import { blockUser, createThread } from '../lib/threads.ts';
import { contentGuard, id as idSchema, optText, parse, text } from '../lib/validate.ts';
import { compact } from '../lib/guards.ts';

// Open decision 2: three requests a day for new clients, raised after a first accepted request.
const NEW_CLIENT_DAILY = 3;
const TRUSTED_CLIENT_DAILY = 10;
const DECLINE_COOLDOWN_DAYS = 7;

const UNAVAILABLE = "This freelancer isn't accepting requests right now.";

const CONNECTION_SQL = `
  SELECT c.id, c.client_id AS "clientUid", c.freelancer_id AS "freelancerUid",
         cp.name AS "clientName", fp.name AS "freelancerName",
         c.project_id AS "projectId", pr.title AS "projectTitle", c.brief_text AS "briefText",
         c.first_message AS "firstMessage", c.status, c.thread_id AS "threadId",
         c.decline_reason AS "declineReason",
         CASE WHEN rf.approved AND NOT rf.paused THEN rf.user_id END AS "referredFreelancerId",
         CASE WHEN rf.approved AND NOT rf.paused THEN rf.name END AS "referredName",
         ${ms('c.created_at')} AS "createdAt"
  FROM connections c
  LEFT JOIN client_profiles cp ON cp.user_id = c.client_id
  LEFT JOIN freelancer_profiles fp ON fp.user_id = c.freelancer_id
  LEFT JOIN freelancer_profiles rf ON rf.user_id = c.referred_freelancer_id
  LEFT JOIN projects pr ON pr.id = c.project_id`;

export async function connectionRoutes(app: FastifyInstance) {
  app.get('/api/connections', async (req) => {
    const user = requireAuth(req);
    const { as } = parse(z.object({ as: z.enum(['in', 'out']) }), req.query);
    const col = as === 'in' ? 'c.freelancer_id' : 'c.client_id';
    const rows = await many(pool, `${CONNECTION_SQL} WHERE ${col} = $1 ORDER BY c.created_at DESC LIMIT 100`, [user.id]);
    return { connections: rows.map((r) => compact(r)) };
  });

  app.post('/api/connections', async (req) => {
    const client = requireRole(req, 'client');
    const body = parse(
      z.object({
        freelancerUid: idSchema('Freelancer'),
        message: text(1000, 'Message'),
        projectId: optText(128),
        brief: optText(2000, 'Brief'),
      }),
      req.body,
    );
    contentGuard(body.message);
    if (body.freelancerUid === client.id) throw new ApiError('invalid-argument', "You can't connect with yourself.");

    return tx(async (c) => {
      const profile = await one<{ name: string; approved: boolean; paused: boolean }>(c, 'SELECT name, approved, paused FROM freelancer_profiles WHERE user_id = $1', [body.freelancerUid]);
      if (!profile || !profile.approved || profile.paused || (await isBlockedEitherWay(c, client.id, body.freelancerUid))) {
        throw new ApiError('failed-precondition', UNAVAILABLE);
      }

      const existing = await one<{ id: string; status: string; thread_id: string | null; age_ms: number }>(
        c,
        `SELECT id, status, thread_id, (extract(epoch from now() - created_at) * 1000)::bigint AS age_ms FROM connections WHERE client_id = $1 AND freelancer_id = $2 FOR UPDATE`,
        [client.id, body.freelancerUid],
      );
      if (existing) {
        if (existing.status === 'pending') throw new ApiError('already-exists', 'You already have a request waiting with this freelancer.');
        if (existing.status === 'accepted') throw new ApiError('already-exists', "You're already connected. Open your messages to continue.", { threadId: existing.thread_id });
        if (existing.status === 'blocked') throw new ApiError('failed-precondition', UNAVAILABLE);
        if (existing.status === 'declined' && existing.age_ms < DECLINE_COOLDOWN_DAYS * DAY) {
          throw new ApiError('failed-precondition', 'This freelancer declined recently. Try again in a few days.');
        }
      }

      const trusted = await one(c, `SELECT 1 FROM connections WHERE client_id = $1 AND status = 'accepted' LIMIT 1`, [client.id]);
      await enforceRateLimit(
        c, 'connect', client.id, trusted ? TRUSTED_CLIENT_DAILY : NEW_CLIENT_DAILY, DAY,
        trusted ? "You've reached today's request limit. Try again tomorrow." : `You can send ${NEW_CLIENT_DAILY} requests a day until your first one is accepted. Try again tomorrow.`,
      );

      let projectId: string | null = null;
      if (body.projectId) {
        const project = await one(c, 'SELECT id FROM projects WHERE id = $1 AND client_id = $2', [body.projectId, client.id]);
        if (project) projectId = body.projectId;
      }

      let connectionId: string;
      if (existing) {
        // A declined (after the cooldown) or expired request is reopened rather than duplicated.
        await c.query(
          `UPDATE connections SET status = 'pending', first_message = $2, brief_text = $3, project_id = $4, decline_reason = NULL,
             referred_freelancer_id = NULL, responded_at = NULL, created_at = now() WHERE id = $1`,
          [existing.id, body.message, body.brief ?? null, projectId],
        );
        connectionId = existing.id;
      } else {
        connectionId = (
          await c.query(
            `INSERT INTO connections (client_id, freelancer_id, project_id, brief_text, first_message) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [client.id, body.freelancerUid, projectId, body.brief ?? null, body.message],
          )
        ).rows[0].id;
      }

      await c.query(
        `INSERT INTO profile_stats_daily (freelancer_id, day, requests) VALUES ($1, current_date, 1)
         ON CONFLICT (freelancer_id, day) DO UPDATE SET requests = profile_stats_daily.requests + 1`,
        [body.freelancerUid],
      );
      const clientName = (await one<{ name: string }>(c, 'SELECT name FROM client_profiles WHERE user_id = $1', [client.id]))?.name || 'A client';
      await notify(c, body.freelancerUid, { type: 'new_request', title: `${clientName} wants to connect`, body: body.message.slice(0, 160), link: '/freelancer/requests', refId: connectionId });
      await emit(c, [client.id, body.freelancerUid], ['connections']);
      return { connectionId };
    });
  });

  app.post('/api/connections/:id/respond', async (req) => {
    const user = requireRole(req, 'freelancer');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const body = parse(
      z.object({
        action: z.enum(['accept', 'decline', 'block'], { error: 'Unknown action.' }),
        reason: z.enum(['booked', 'budget', 'skills', 'other']).optional(),
        referTo: optText(128),
      }),
      req.body,
    );

    return tx(async (c) => {
      const conn = await one<{ id: string; client_id: string; status: string; first_message: string; created_at: Date }>(
        c, 'SELECT id, client_id, status, first_message, created_at FROM connections WHERE id = $1 AND freelancer_id = $2 FOR UPDATE', [id, user.id],
      );
      if (!conn) throw new ApiError('not-found', 'Request not found.');
      const me = (await one<{ name: string }>(c, 'SELECT name FROM freelancer_profiles WHERE user_id = $1', [user.id]))?.name || 'A freelancer';

      if (body.action === 'block') {
        await blockUser(c, user.id, conn.client_id);
        await emit(c, [user.id, conn.client_id], ['connections', 'threads']);
        return { status: 'blocked' };
      }
      if (conn.status !== 'pending') throw new ApiError('failed-precondition', 'That request was already answered.');

      if (body.action === 'decline') {
        let referral: string | null = null;
        if (body.referTo && body.referTo !== user.id && body.referTo !== conn.client_id) {
          const target = await one(c, 'SELECT 1 FROM freelancer_profiles WHERE user_id = $1 AND approved AND NOT paused', [body.referTo]);
          if (!target) throw new ApiError('invalid-argument', 'That freelancer is not available to recommend.');
          referral = body.referTo;
        }
        await c.query(`UPDATE connections SET status = 'declined', decline_reason = $2, referred_freelancer_id = $3, responded_at = now() WHERE id = $1`, [id, body.reason ?? null, referral]);
        await notify(c, conn.client_id, {
          type: 'request_declined',
          title: `${me} can't take this on`,
          body: referral ? 'They recommended someone else who may be a good fit.' : 'You can look for other people who match your brief.',
          link: referral ? `/freelancer/${referral}` : '/',
          refId: id,
        });
        await emit(c, [user.id, conn.client_id], ['connections']);
        return { status: 'declined' };
      }

      const threadId = await createThread(c, {
        connectionId: id, clientId: conn.client_id, freelancerId: user.id,
        firstMessage: conn.first_message, firstSenderId: conn.client_id, firstMessageAt: conn.created_at,
      });
      await c.query(`UPDATE connections SET status = 'accepted', responded_at = now() WHERE id = $1`, [id]);
      await notify(c, conn.client_id, { type: 'request_accepted', title: `${me} accepted your request`, body: 'You can now message each other.', link: `/messages/${threadId}`, refId: id });
      await emit(c, [user.id, conn.client_id], ['connections', 'threads']);
      return { status: 'accepted', threadId };
    });
  });

  app.post('/api/blocks', async (req) => {
    const user = requireAuth(req);
    const { targetUid } = parse(z.object({ targetUid: idSchema('targetUid') }), req.body);
    if (targetUid === user.id) throw new ApiError('invalid-argument', "You can't block yourself.");
    await tx(async (c) => {
      if (!(await one(c, 'SELECT 1 FROM users WHERE id = $1', [targetUid]))) throw new ApiError('not-found', 'Person not found.');
      await blockUser(c, user.id, targetUid);
      await emit(c, [user.id, targetUid], ['connections', 'threads']);
    });
    return { blocked: true };
  });
}
