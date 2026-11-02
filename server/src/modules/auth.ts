import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import { one, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { enqueueMail } from '../lib/mailer.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/passwords.ts';
import { DAY, HOUR, enforceRateLimit } from '../lib/rateLimit.ts';
import { clientIp, createSession, destroySession, requireAuth } from '../lib/session.ts';
import { storage } from '../lib/storage.ts';
import { optText, parse } from '../lib/validate.ts';

const email = z.string({ error: 'Email is required.' }).trim().toLowerCase().email('Enter a valid email address.').max(200);
const password = z.string({ error: 'Password is required.' }).min(8, 'Use at least 8 characters.').max(128, 'That password is too long.');

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

async function profileName(userId: string, role: string): Promise<string> {
  const table = role === 'freelancer' ? 'freelancer_profiles' : role === 'client' ? 'client_profiles' : null;
  if (!table) return 'Bench admin';
  return (await one<{ name: string }>(pool, `SELECT name FROM ${table} WHERE user_id = $1`, [userId]))?.name ?? '';
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/signup', async (req, reply) => {
    const body = parse(
      z.object({
        email,
        password,
        role: z.enum(['client', 'freelancer'], { error: 'Choose client or freelancer.' }),
        name: optText(80, 'Name'),
        timezone: z.string().max(64).optional(),
      }),
      req.body,
    );
    await enforceRateLimit(pool, 'signup', clientIp(req), 10, HOUR, 'Too many sign-ups from this network. Try again later.');

    const hash = await hashPassword(body.password);
    const user = await tx(async (c) => {
      const taken = await one(c, 'SELECT id FROM users WHERE email = $1', [body.email]);
      if (taken) {
        throw new ApiError('already-exists', 'An account with this email already exists. One email can hold only one account type, so sign in or use a different email.');
      }
      const row = (await c.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [body.email, hash, body.role])).rows[0];
      if (body.role === 'client') {
        await c.query('INSERT INTO client_profiles (user_id, name) VALUES ($1, $2)', [row.id, body.name ?? '']);
      } else {
        await c.query('INSERT INTO freelancer_profiles (user_id, name, timezone) VALUES ($1, $2, $3)', [row.id, body.name ?? '', body.timezone ?? 'UTC']);
      }
      await createSession(c, reply, row.id);
      return { id: row.id as string };
    }).catch((error) => {
      // Two parallel sign-ups for one email race past the check; the unique index still wins.
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError('already-exists', 'An account with this email already exists. One email can hold only one account type, so sign in or use a different email.');
      }
      throw error;
    });
    return { user: { id: user.id, email: body.email, role: body.role, isAdmin: false, name: body.name ?? '' } };
  });

  app.post('/api/auth/signin', async (req, reply) => {
    const body = parse(z.object({ email, password: z.string().min(1, 'Password is required.').max(128) }), req.body);
    await enforceRateLimit(pool, 'signin', `${clientIp(req)}:${body.email}`, 10, 15 * 60 * 1000, 'Too many sign-in attempts. Try again in a few minutes.');
    const row = await one<{ id: string; password_hash: string; role: 'client' | 'freelancer' | 'admin'; is_admin: boolean; email: string }>(
      pool,
      'SELECT id, email, password_hash, role, is_admin FROM users WHERE email = $1',
      [body.email],
    );
    const ok = await verifyPassword(body.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) throw new ApiError('unauthenticated', 'Incorrect email or password.');
    await createSession(pool, reply, row.id);
    return { user: { id: row.id, email: row.email, role: row.role, isAdmin: row.is_admin, name: await profileName(row.id, row.role) } };
  });

  app.post('/api/auth/signout', async (req, reply) => {
    await destroySession(pool, req, reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => {
    if (!req.user) return { user: null };
    return { user: { ...req.user, name: await profileName(req.user.id, req.user.role) } };
  });

  // Always answers the same way so the form cannot be used to discover which emails have accounts.
  app.post('/api/auth/reset-request', async (req) => {
    const body = parse(z.object({ email }), req.body);
    await enforceRateLimit(pool, 'reset', clientIp(req), 10, HOUR, 'Too many reset requests. Try again later.');
    const user = await one<{ id: string }>(pool, 'SELECT id FROM users WHERE email = $1', [body.email]);
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      await tx(async (c) => {
        await c.query(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [sha256(token), user.id]);
        await enqueueMail(c, body.email, 'Reset your Bench password', `Use this link within an hour to choose a new password:\n\n${config.appUrl}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`);
      });
    }
    return { ok: true };
  });

  app.post('/api/auth/reset-confirm', async (req) => {
    const body = parse(z.object({ token: z.string().min(10).max(200), password }), req.body);
    const hash = await hashPassword(body.password);
    await tx(async (c) => {
      const row = await one<{ user_id: string }>(
        c,
        `UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
        [sha256(body.token)],
      );
      if (!row) throw new ApiError('failed-precondition', 'That reset link has expired. Request a new one.');
      await c.query('UPDATE users SET password_hash = $2 WHERE id = $1', [row.user_id, hash]);
      await c.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id]);
    });
    return { ok: true };
  });

  // Self-serve deletion: profile, messages, shortlists, files and the sign-in itself, in one transaction.
  app.delete('/api/account', async (req, reply) => {
    const user = requireAuth(req);
    await enforceRateLimit(pool, 'delete-account', user.id, 5, DAY);
    const threadIds = await tx(async (c) => {
      const threads = (await c.query('SELECT thread_id FROM thread_participants WHERE user_id = $1', [user.id])).rows;
      await c.query('DELETE FROM users WHERE id = $1', [user.id]);
      return threads.map((t) => t.thread_id as string);
    });
    // Files go only after the rows are gone for good.
    for (const id of threadIds) await storage.removePrefix(`attachments/${id}`).catch(() => undefined);
    for (const prefix of [`avatars/${user.id}`, `resumes/${user.id}`, `portfolio/${user.id}`]) await storage.removePrefix(prefix).catch(() => undefined);
    reply.clearCookie('bench_session', { path: '/' });
    return { deleted: true };
  });
}
