import nodemailer from 'nodemailer';
import { config } from '../config.ts';
import { pool, type Db } from '../db/client.ts';

/** Queues an email. It is sent by the worker, so a slow or failing SMTP server never blocks a request. */
export async function enqueueMail(db: Db, to: string, subject: string, body: string): Promise<void> {
  await db.query('INSERT INTO mail_outbox (to_email, subject, body) VALUES ($1, $2, $3)', [to, subject, body]);
}

const transport = config.smtp.url ? nodemailer.createTransport(config.smtp.url) : null;
const MAX_ATTEMPTS = 5;

/** Sends due mail once. Returns how many were delivered. Rows are locked so parallel workers do not double-send. */
export async function flushOutbox(): Promise<number> {
  const client = await pool.connect();
  let sent = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, to_email, subject, body, attempts FROM mail_outbox
       WHERE sent_at IS NULL AND send_after <= now() AND attempts < $1
       ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED`,
      [MAX_ATTEMPTS],
    );
    for (const row of rows) {
      try {
        if (transport) {
          await transport.sendMail({ from: config.smtp.from, to: row.to_email, subject: row.subject, text: row.body });
        } else if (!config.isTest) {
          console.log(`[mail] to=${row.to_email} subject="${row.subject}"\n${row.body}\n`);
        }
        await client.query('UPDATE mail_outbox SET sent_at = now(), attempts = attempts + 1 WHERE id = $1', [row.id]);
        sent++;
      } catch (error) {
        // Back off 1, 4, 16... minutes.
        await client.query(
          `UPDATE mail_outbox SET attempts = attempts + 1, last_error = $2, send_after = now() + (power(4, attempts) * interval '1 minute') WHERE id = $1`,
          [row.id, String((error as Error).message).slice(0, 300)],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return sent;
}
