import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

/**
 * Serves the built frontend (`npm run build`) from the same process and origin as the API, so one
 * service runs the whole product and the session cookie needs no cross-site settings.
 * Does nothing when there is no build directory.
 */
export async function staticRoutes(app: FastifyInstance) {
  const root = config.staticDir;
  if (!root || !fs.existsSync(path.join(root, 'index.html'))) return;

  app.get('/*', async (req, reply) => {
    const url = decodeURIComponent((req.raw.url ?? '/').split('?')[0]);
    if (url.startsWith('/api/')) return reply.status(404).send({ error: { code: 'not-found', message: 'Not found.' } });
    let file = path.join(root, path.normalize(url));
    // Never leave the build directory; unknown paths are client-side routes.
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const ext = path.extname(file);
    const hashed = file.includes(`${path.sep}assets${path.sep}`);
    return reply
      .header('Content-Type', TYPES[ext] ?? 'application/octet-stream')
      .header('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache')
      .send(fs.createReadStream(file));
  });
}
