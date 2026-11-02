import type { Db } from '../db/client.ts';

/** Opens a conversation for a connection. The connect message becomes the first (system) message. */
export async function createThread(
  c: Db,
  o: { connectionId: string; clientId: string; freelancerId: string; firstMessage: string; firstSenderId: string; firstMessageAt?: Date | null },
): Promise<string> {
  const thread = (
    await c.query(`INSERT INTO threads (connection_id, last_message) VALUES ($1, $2) RETURNING id`, [o.connectionId, o.firstMessage.slice(0, 140)])
  ).rows[0];
  const receiver = o.firstSenderId === o.clientId ? o.freelancerId : o.clientId;
  await c.query(`INSERT INTO thread_participants (thread_id, user_id, unread) VALUES ($1, $2, 0), ($1, $3, 1)`, [thread.id, o.firstSenderId, receiver]);
  await c.query(`INSERT INTO messages (thread_id, sender_id, text, system, created_at) VALUES ($1, $2, $3, true, COALESCE($4, now()))`, [
    thread.id, o.firstSenderId, o.firstMessage, o.firstMessageAt ?? null,
  ]);
  await c.query(`UPDATE connections SET thread_id = $2 WHERE id = $1`, [o.connectionId, thread.id]);
  return thread.id as string;
}

/** Blocks `target` for `blocker`, closes their conversations and marks any request between them as blocked. */
export async function blockUser(c: Db, blocker: string, target: string): Promise<void> {
  await c.query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [blocker, target]);
  await c.query(
    `UPDATE threads SET closed = true WHERE connection_id IN
       (SELECT id FROM connections WHERE (client_id = $1 AND freelancer_id = $2) OR (client_id = $2 AND freelancer_id = $1))`,
    [blocker, target],
  );
  await c.query(
    `UPDATE connections SET status = 'blocked' WHERE (client_id = $1 AND freelancer_id = $2) OR (client_id = $2 AND freelancer_id = $1)`,
    [blocker, target],
  );
}
