import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { one, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { emit } from '../lib/events.ts';
import { HOUR, enforceRateLimit } from '../lib/rateLimit.ts';
import { requireAuth, requireRole } from '../lib/session.ts';
import { MIME_BY_EXT, newFileName, sniff, storage, type FileKind } from '../lib/storage.ts';
import { id as idSchema, parse } from '../lib/validate.ts';

const MB = 1024 * 1024;

async function readUpload(req: import('fastify').FastifyRequest, maxBytes: number, allowed: FileKind[]) {
  const part = await req.file({ limits: { fileSize: maxBytes, files: 1 } });
  if (!part) throw new ApiError('invalid-argument', 'Choose a file to upload.');
  let data: Buffer;
  try {
    data = await part.toBuffer();
  } catch {
    throw new ApiError('invalid-argument', `That file is too large. The limit is ${Math.round(maxBytes / MB)} MB.`);
  }
  if (data.length === 0) throw new ApiError('invalid-argument', 'That file is empty.');
  const kind = sniff(data);
  if (!kind || !allowed.includes(kind.kind)) throw new ApiError('invalid-argument', "That file type isn't supported.");
  return { data, kind, name: path.basename(part.filename || 'file').slice(-120) };
}

function send(reply: FastifyReply, key: string, data: Buffer, opts: { isPublic: boolean }) {
  const ext = path.posix.extname(key).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  const inline = mime.startsWith('image/');
  reply
    .header('Content-Type', mime)
    .header('X-Content-Type-Options', 'nosniff')
    .header('Content-Security-Policy', "default-src 'none'; sandbox")
    .header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${path.posix.basename(key).replace(/"/g, '')}"`)
    .header('Cache-Control', opts.isPublic ? 'public, max-age=31536000, immutable' : 'private, no-store');
  return reply.send(data);
}

async function participantOf(threadId: string, userId: string) {
  const row = await one<{ closed: boolean }>(
    pool, `SELECT t.closed FROM threads t JOIN thread_participants tp ON tp.thread_id = t.id AND tp.user_id = $2 WHERE t.id = $1`, [threadId, userId],
  );
  if (!row) throw new ApiError('not-found', 'Conversation not found.');
  return row;
}

export async function fileRoutes(app: FastifyInstance) {
  for (const kind of ['avatars', 'portfolio'] as const) {
    app.post(`/api/files/${kind}`, async (req) => {
      const user = requireRole(req, 'freelancer');
      await enforceRateLimit(pool, 'upload', user.id, 60, HOUR, 'You have uploaded a lot of files. Try again later.');
      const file = await readUpload(req, 5 * MB, ['image']);
      const name = newFileName(file.kind.ext);
      await storage.put(`${kind}/${user.id}/${name}`, file.data);
      return { url: `/api/files/public/${kind}/${user.id}/${name}` };
    });
  }

  app.post('/api/files/resumes', async (req) => {
    const user = requireRole(req, 'freelancer');
    await enforceRateLimit(pool, 'upload', user.id, 60, HOUR, 'You have uploaded a lot of files. Try again later.');
    const file = await readUpload(req, 10 * MB, ['pdf']);
    const key = `resumes/${user.id}/resume.pdf`;
    await storage.put(key, file.data);
    await tx(async (c) => {
      await c.query('UPDATE freelancer_profiles SET resume_path = $2 WHERE user_id = $1', [user.id, key]);
      await emit(c, [user.id], ['profile']);
    });
    return { path: key };
  });

  app.post('/api/threads/:id/attachments', async (req) => {
    const user = requireAuth(req);
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const thread = await participantOf(id, user.id);
    if (thread.closed) throw new ApiError('failed-precondition', 'This conversation is closed.');
    await enforceRateLimit(pool, 'upload', user.id, 60, HOUR, 'You have uploaded a lot of files. Try again later.');
    const file = await readUpload(req, 10 * MB, ['image', 'gif', 'pdf', 'text']);
    const key = `attachments/${id}/${newFileName(file.kind.ext)}`;
    await storage.put(key, file.data);
    return { name: file.name, path: key, url: `/api/files/${key}`, type: file.kind.mime, size: file.data.length };
  });

  const fileParams = z.object({ a: z.string().max(128), b: z.string().max(128), file: z.string().regex(/^[\w.-]+$/).max(128) });

  app.get('/api/files/public/:a/:b/:file', async (req, reply) => {
    const { a: kind, b: uid, file } = parse(fileParams, req.params);
    if (kind !== 'avatars' && kind !== 'portfolio') throw new ApiError('not-found', 'File not found.');
    const key = `${kind}/${uid}/${file}`;
    const data = await storage.get(key);
    if (!data) throw new ApiError('not-found', 'File not found.');
    return send(reply, key, data, { isPublic: true });
  });

  app.get('/api/files/attachments/:a/:file', async (req, reply) => {
    const user = requireAuth(req);
    const { a: threadId, file } = parse(fileParams.omit({ b: true }), req.params);
    await participantOf(threadId, user.id);
    const key = `attachments/${threadId}/${file}`;
    const data = await storage.get(key);
    if (!data) throw new ApiError('not-found', 'File not found.');
    return send(reply, key, data, { isPublic: false });
  });

  app.get('/api/files/resumes/:a/:file', async (req, reply) => {
    const user = requireAuth(req);
    const { a: uid, file } = parse(fileParams.omit({ b: true }), req.params);
    if (user.id !== uid && !user.isAdmin) throw new ApiError('not-found', 'File not found.');
    const key = `resumes/${uid}/${file}`;
    const data = await storage.get(key);
    if (!data) throw new ApiError('not-found', 'File not found.');
    return send(reply, key, data, { isPublic: false });
  });
}
