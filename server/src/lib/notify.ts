import { config } from '../config.ts';
import type { Db } from '../db/client.ts';
import { emit } from './events.ts';
import { enqueueMail } from './mailer.ts';

export type NotificationType =
  | 'new_request'
  | 'request_accepted'
  | 'request_declined'
  | 'request_expired'
  | 'new_message'
  | 'proposal_received'
  | 'profile_status'
  | 'new_review'
  | 'project_match'
  | 'search_alert';

const EMAIL_DEFAULT: Partial<Record<NotificationType, boolean>> = {
  new_request: true,
  request_accepted: true,
  new_message: true,
  proposal_received: true,
  search_alert: true,
};

const SUBJECTS: Partial<Record<NotificationType, string>> = {
  new_request: 'New connect request on Bench',
  request_accepted: 'Your request was accepted on Bench',
  new_message: 'New message on Bench',
  proposal_received: 'New proposal on Bench',
  search_alert: 'A new match for your saved search on Bench',
};

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  link: string;
  refId?: string;
}

/**
 * Writes the in-app notification and queues an email when the person allows it.
 * Call inside the same transaction as the change that caused it.
 */
export async function notify(db: Db, userId: string, input: NotifyInput): Promise<void> {
  const { rows } = await db.query(
    `SELECT u.email, p.prefs -> $2 AS pref FROM users u LEFT JOIN notification_prefs p ON p.user_id = u.id WHERE u.id = $1`,
    [userId, input.type],
  );
  if (rows.length === 0) return;
  const pref = (rows[0].pref ?? {}) as { inApp?: boolean; email?: boolean };
  const inApp = pref.inApp !== false;
  const email = pref.email !== undefined ? pref.email === true : EMAIL_DEFAULT[input.type] === true;

  if (inApp) {
    await db.query(
      `INSERT INTO notifications (user_id, type, ref_id, title, body, link) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, input.type, input.refId ?? null, input.title, input.body ?? '', input.link],
    );
    await emit(db, [userId], ['notifications']);
  }
  const subject = SUBJECTS[input.type];
  if (email && subject) {
    await enqueueMail(db, rows[0].email, subject, `${input.title}\n\n${input.body ?? ''}\n\n${config.appUrl}${input.link}`);
  }
}
