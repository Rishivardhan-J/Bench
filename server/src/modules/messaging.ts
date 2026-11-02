import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { detectOffPlatform } from '@/lib/offPlatform';
import { many, one, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { emit } from '../lib/events.ts';
import { compact, ms } from '../lib/guards.ts';
import { notify } from '../lib/notify.ts';
import { enforceRateLimit } from '../lib/rateLimit.ts';
import { requireAuth } from '../lib/session.ts';
import { MIME_BY_EXT, storage } from '../lib/storage.ts';
import { id as idSchema, parse } from '../lib/validate.ts';

const MESSAGES_PER_MINUTE = 30;
/** Until the other person replies, a new contact can receive only this many messages. */
const UNANSWERED_CAP = 5;
/** The off-platform check applies to the first exchange only. */
const EARLY_MESSAGES = 6;

const attachmentSchema = z.object({ path: z.string().max(300), name: z.string().max(120), size: z.number().int().min(0).max(10 * 1024 * 1024).default(0) });

async function requireParticipant(db: typeof pool | import('pg').PoolClient, threadId: string, userId: string) {
  const row = await one<{ id: string; closed: boolean; connection_id: string }>(
    db,
    `SELECT t.id, t.closed, t.connection_id FROM threads t JOIN thread_participants tp ON tp.thread_id = t.id AND tp.user_id = $2 WHERE t.id = $1`,
    [threadId, userId],
  );
  // The same answer for "missing" and "not yours" so thread ids cannot be probed.
  if (!row) throw new ApiError('not-found', 'Conversation not found.');
  return row;
}

export async function messagingRoutes(app: FastifyInstance) {
  app.get('/api/threads', async (req) => {
    const user = requireAuth(req);
    const threads = await many<Record<string, unknown>>(
      pool,
      `SELECT t.id, t.connection_id AS "connectionId", t.closed, t.hire_id AS "hireId", t.last_message AS "lastMessage", ${ms('t.last_message_at')} AS "lastMessageAt"
       FROM threads t JOIN thread_participants me ON me.thread_id = t.id AND me.user_id = $1
       ORDER BY t.last_message_at DESC LIMIT 100`,
      [user.id],
    );
    if (threads.length === 0) return { threads: [] };
    const people = await many<{ thread_id: string; user_id: string; unread: number; last_read: number | null; name: string | null }>(
      pool,
      `SELECT tp.thread_id, tp.user_id, tp.unread, ${ms('tp.last_read')} AS last_read, COALESCE(cp.name, fp.name) AS name
       FROM thread_participants tp
       LEFT JOIN client_profiles cp ON cp.user_id = tp.user_id
       LEFT JOIN freelancer_profiles fp ON fp.user_id = tp.user_id
       WHERE tp.thread_id = ANY($1)`,
      [threads.map((t) => t.id)],
    );
    return {
      threads: threads.map((t) => {
        const mine = people.filter((p) => p.thread_id === t.id);
        return compact({
          ...t,
          participants: mine.map((p) => p.user_id),
          names: Object.fromEntries(mine.map((p) => [p.user_id, p.name || 'Someone'])),
          unread: Object.fromEntries(mine.map((p) => [p.user_id, p.unread])),
          lastRead: Object.fromEntries(mine.map((p) => [p.user_id, p.last_read ?? 0])),
        });
      }),
    };
  });

  app.get('/api/threads/:id/messages', async (req) => {
    const user = requireAuth(req);
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await requireParticipant(pool, id, user.id);
    const rows = await many(
      pool,
      `SELECT id, sender_id AS "senderUid", text, attachments, system, ${ms('created_at')} AS "createdAt"
       FROM (SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 500) m ORDER BY created_at ASC`,
      [id],
    );
    return { messages: rows };
  });

  app.post('/api/threads/:id/messages', async (req) => {
    const user = requireAuth(req);
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const body = parse(
      z.object({
        text: z.string().max(4000, 'Messages can be up to 4,000 characters.').transform((s) => s.replaceAll('\0', '').trim()).default(''),
        attachments: z.array(attachmentSchema).max(5, 'You can attach up to 5 files.').default([]),
        confirmOffPlatform: z.boolean().optional(),
      }),
      req.body,
    );
    if (!body.text && body.attachments.length === 0) throw new ApiError('invalid-argument', 'Write a message or attach a file.');

    // Attachments are rebuilt from our own storage: the caller cannot supply a URL or a type.
    const attachments: { name: string; path: string; url: string; type: string; size: number }[] = [];
    for (const a of body.attachments) {
      const ext = path.posix.extname(a.path).slice(1).toLowerCase();
      if (!a.path.startsWith(`attachments/${id}/`) || a.path.includes('..') || !MIME_BY_EXT[ext] || !(await storage.exists(a.path))) {
        throw new ApiError('invalid-argument', 'One of the attachments is not valid. Upload it again.');
      }
      attachments.push({ name: a.name.replace(/[\r\n]/g, ' '), path: a.path, url: `/api/files/${a.path}`, type: MIME_BY_EXT[ext], size: a.size });
    }

    return tx(async (c) => {
      await requireParticipant(c, id, user.id);
      // Lock the thread so counters and the unanswered cap stay correct under parallel sends.
      const thread = (await c.query('SELECT closed, connection_id FROM threads WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (thread.closed) throw new ApiError('failed-precondition', 'This conversation is closed.');
      await enforceRateLimit(c, 'msg', user.id, MESSAGES_PER_MINUTE, 60 * 1000, 'You are sending messages too quickly. Wait a moment.');

      const stats = (
        await c.query(
          `SELECT count(*) FILTER (WHERE NOT system) AS total,
                  count(*) FILTER (WHERE NOT system AND sender_id = $2) AS mine,
                  count(*) FILTER (WHERE NOT system AND sender_id <> $2) AS theirs
           FROM messages WHERE thread_id = $1`,
          [id, user.id],
        )
      ).rows[0];
      if (stats.theirs === 0 && stats.mine >= UNANSWERED_CAP) {
        throw new ApiError('resource-exhausted', 'Wait for a reply before sending more messages.');
      }
      if (stats.total < EARLY_MESSAGES && !body.confirmOffPlatform) {
        const reason = detectOffPlatform(body.text);
        if (reason) throw new ApiError('failed-precondition', 'This message looks like it moves the conversation off Bench.', { offPlatform: reason });
      }

      const message = (
        await c.query(
          `INSERT INTO messages (thread_id, sender_id, text, attachments) VALUES ($1, $2, $3, $4)
           RETURNING id, sender_id AS "senderUid", text, attachments, ${ms('created_at')} AS "createdAt"`,
          [id, user.id, body.text, JSON.stringify(attachments)],
        )
      ).rows[0];

      const preview = (body.text || 'Sent an attachment').slice(0, 140);
      await c.query('UPDATE threads SET last_message = $2, last_message_at = now() WHERE id = $1', [id, preview]);
      const other = (
        await c.query(
          `UPDATE thread_participants SET unread = unread + 1 WHERE thread_id = $1 AND user_id <> $2 RETURNING user_id, unread`,
          [id, user.id],
        )
      ).rows[0];

      // Response time comes from real replies: the freelancer's first message in a thread.
      if (user.role === 'freelancer' && stats.mine === 0) {
        await c.query(
          `UPDATE freelancer_profiles p SET
             reply_count = reply_count + 1,
             reply_minutes_total = reply_minutes_total + m.minutes,
             avg_response_minutes = CASE WHEN reply_count + 1 >= 3 THEN round((reply_minutes_total + m.minutes)::numeric / (reply_count + 1)) ELSE avg_response_minutes END
           FROM (SELECT greatest(1, round(extract(epoch from now() - created_at) / 60))::int AS minutes FROM connections WHERE id = $2) m
           WHERE p.user_id = $1`,
          [user.id, thread.connection_id],
        );
      }

      if (other && other.unread === 1) {
        const senderName = (await one<{ name: string }>(c, `SELECT COALESCE(cp.name, fp.name) AS name FROM users u LEFT JOIN client_profiles cp ON cp.user_id = u.id LEFT JOIN freelancer_profiles fp ON fp.user_id = u.id WHERE u.id = $1`, [user.id]))?.name;
        await notify(c, other.user_id, { type: 'new_message', title: `New message from ${senderName || 'someone'}`, body: preview.slice(0, 160), link: `/messages/${id}`, refId: id });
      }
      await emit(c, [user.id, other?.user_id].filter(Boolean) as string[], ['threads', `messages:${id}`]);
      return { message };
    });
  });

  // Clears this person's unread count and stamps their read time.
  app.post('/api/threads/:id/read', async (req) => {
    const user = requireAuth(req);
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await requireParticipant(pool, id, user.id);
    await tx(async (c) => {
      await c.query('UPDATE thread_participants SET unread = 0, last_read = now() WHERE thread_id = $1 AND user_id = $2', [id, user.id]);
      const others = (await c.query('SELECT user_id FROM thread_participants WHERE thread_id = $1', [id])).rows.map((r) => r.user_id as string);
      await emit(c, others, ['threads']);
    });
    return { ok: true };
  });
}
