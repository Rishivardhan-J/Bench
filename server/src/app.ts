import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { config } from './config.ts';
import { ApiError } from './lib/errors.ts';
import { hub } from './lib/hub.ts';
import { COOKIE, loadUser } from './lib/session.ts';
import { accountDataRoutes } from './modules/account-data.ts';
import { aiRoutes } from './modules/ai.ts';
import { authRoutes } from './modules/auth.ts';
import { connectionRoutes } from './modules/connections.ts';
import { fileRoutes } from './modules/files.ts';
import { freelancerRoutes } from './modules/freelancers.ts';
import { hireRoutes } from './modules/hires.ts';
import { messagingRoutes } from './modules/messaging.ts';
import { moderationRoutes } from './modules/moderation.ts';
import { projectRoutes } from './modules/projects.ts';
import { shortlistRoutes } from './modules/shortlists.ts';
import { staticRoutes } from './modules/static.ts';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.isTest ? false : { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  await app.register(websocket);

  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req) => {
    // Cookie auth needs a CSRF defence: state-changing requests must come from our own origin.
    if (!SAFE.has(req.method)) {
      const origin = req.headers.origin;
      if (!origin || !config.appOrigins.includes(origin)) throw new ApiError('permission-denied', 'This request was blocked.');
    }
    req.user = await loadUser(req.cookies[COOKIE]);
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'same-origin');
    if (!reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    const e = error as { statusCode?: number; code?: string; message: string };
    if (e.code === '23505') return reply.status(409).send({ error: { code: 'already-exists', message: 'That already exists.' } });
    if (e.code === '23503') return reply.status(404).send({ error: { code: 'not-found', message: 'That no longer exists.' } });
    if (e.code === '23514' || e.code === '22P02') return reply.status(400).send({ error: { code: 'invalid-argument', message: 'Some of those details are not valid.' } });
    if (e.statusCode && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: { code: e.statusCode === 413 ? 'invalid-argument' : 'invalid-argument', message: e.statusCode === 413 ? 'That is too large.' : 'That request was not valid.' } });
    }
    req.log.error(error);
    return reply.status(500).send({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } });
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'not-found', message: 'Not found.' } }));

  app.get('/api/health', async () => ({ ok: true }));

  // Live updates: the server only says "something changed"; the browser refetches through the normal API.
  app.get('/api/ws', { websocket: true }, (socket, req) => {
    const origin = req.headers.origin;
    if (!req.user || !origin || !config.appOrigins.includes(origin)) {
      socket.close(4401, 'unauthenticated');
      return;
    }
    hub.add(socket, req.user.id);
  });

  await app.register(authRoutes);
  await app.register(freelancerRoutes);
  await app.register(connectionRoutes);
  await app.register(messagingRoutes);
  await app.register(hireRoutes);
  await app.register(projectRoutes);
  await app.register(shortlistRoutes);
  await app.register(accountDataRoutes);
  await app.register(moderationRoutes);
  await app.register(fileRoutes);
  await app.register(aiRoutes);
  if (!config.isTest) await app.register(staticRoutes);

  return app;
}
