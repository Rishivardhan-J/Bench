import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.ts';
import { one, pool, type Db } from '../db/client.ts';
import { ApiError } from './errors.ts';

export const COOKIE = 'bench_session';

export interface SessionUser {
  id: string;
  email: string;
  role: 'client' | 'freelancer' | 'admin';
  isAdmin: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(db: Db, reply: FastifyReply, userId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 24 * 60 * 60;
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 second'))`, [sha256(token), userId, maxAge]);
  reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge });
}

export async function loadUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  return one<SessionUser>(
    pool,
    `SELECT u.id, u.email, u.role, u.is_admin AS "isAdmin" FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
}

export async function destroySession(db: Db, req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[COOKIE];
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  reply.clearCookie(COOKIE, { path: '/' });
}

export function requireAuth(req: FastifyRequest): SessionUser {
  if (!req.user) throw new ApiError('unauthenticated', 'Please sign in to continue.');
  return req.user;
}

export function requireRole(req: FastifyRequest, role: 'client' | 'freelancer'): SessionUser {
  const user = requireAuth(req);
  if (user.role !== role) throw new ApiError('permission-denied', `This action is only available to ${role} accounts.`);
  return user;
}

export function requireAdmin(req: FastifyRequest): SessionUser {
  const user = requireAuth(req);
  if (!user.isAdmin) throw new ApiError('permission-denied', 'Admin access required.');
  return user;
}

export const clientIp = (req: FastifyRequest) => req.ip || 'unknown';
