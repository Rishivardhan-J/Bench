import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { pool } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';

let app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    await migrate();
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function resetDb() {
  await pool.query('TRUNCATE users, mail_outbox, rate_limits CASCADE');
}

export async function closeApp() {
  await app?.close();
  app = null;
  await pool.end();
}

export interface Reply<T = any> {
  status: number;
  body: T;
  raw: Buffer;
  headers: Record<string, unknown>;
}

/** A browser-like caller: keeps its session cookie and sends an allowed Origin. */
export class Client {
  cookie = '';
  constructor(private readonly origin: string | null = 'http://localhost:5173') {}

  async call<T = any>(method: string, url: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<Reply<T>> {
    const server = await getApp();
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.origin) headers.origin = this.origin;
    if (this.cookie) headers.cookie = this.cookie;
    const res = await server.inject({ method: method as 'GET', url, headers, payload: body as object | undefined });
    const set = res.cookies.find((c) => c.name === 'bench_session');
    if (set) this.cookie = set.value ? `bench_session=${set.value}` : '';
    let parsed: any = null;
    try {
      parsed = res.body ? JSON.parse(res.body) : null;
    } catch {
      parsed = null;
    }
    return { status: res.statusCode, body: parsed, raw: res.rawPayload, headers: res.headers };
  }

  get = <T = any>(url: string) => this.call<T>('GET', url);
  post = <T = any>(url: string, body?: unknown) => this.call<T>('POST', url, body ?? {});
  put = <T = any>(url: string, body?: unknown) => this.call<T>('PUT', url, body ?? {});
  patch = <T = any>(url: string, body?: unknown) => this.call<T>('PATCH', url, body ?? {});
  del = <T = any>(url: string) => this.call<T>('DELETE', url);

  /** multipart upload of a single file field */
  async upload(url: string, data: Buffer, filename: string, contentType = 'application/octet-stream'): Promise<Reply> {
    const boundary = '----benchtest';
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
    const payload = Buffer.concat([head, data, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const server = await getApp();
    const res = await server.inject({
      method: 'POST', url, payload,
      headers: { origin: this.origin ?? '', cookie: this.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    let parsed: any = null;
    try { parsed = JSON.parse(res.body); } catch { parsed = null; }
    return { status: res.statusCode, body: parsed, raw: res.rawPayload, headers: res.headers };
  }
}

export async function signUp(role: 'client' | 'freelancer', email: string, name = 'Test Person'): Promise<{ client: Client; id: string }> {
  const client = new Client();
  const res = await client.post('/api/auth/signup', { email, password: 'password123', role, name, timezone: 'UTC' });
  if (res.status !== 200) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { client, id: res.body.user.id };
}

export const PROFILE_DRAFT = {
  name: 'Alex Rivera', headline: 'Product designer for B2B SaaS',
  bio: 'Senior product designer with eight years of experience building B2B SaaS applications and design systems for fast teams.',
  skills: ['Figma', 'UI/UX', 'Prototyping'], rateMin: 80, rateMax: 120, currency: 'USD', timezone: 'America/New_York',
  portfolioUrl: 'https://alex.example.com', languages: ['English'],
  experience: [{ title: 'Designer', company: 'Ledgerly', startYear: 2020 }], education: [], portfolio: [], availability: 'now',
};

export async function adminClient(): Promise<Client> {
  const { hashPassword } = await import('../src/lib/passwords.ts');
  await pool.query(`INSERT INTO users (id, email, password_hash, role, is_admin) VALUES ('admin1', 'admin@bench.test', $1, 'admin', true) ON CONFLICT DO NOTHING`, [await hashPassword('password123')]);
  const client = new Client();
  const res = await client.post('/api/auth/signin', { email: 'admin@bench.test', password: 'password123' });
  if (res.status !== 200) throw new Error('admin sign-in failed');
  return client;
}

/** A freelancer with an approved, live profile. */
export async function liveFreelancer(email: string, overrides: Record<string, unknown> = {}, admin?: Client) {
  const f = await signUp('freelancer', email, 'Alex Rivera');
  const saved = await f.client.put('/api/me/freelancer', { draft: { ...PROFILE_DRAFT, ...overrides }, submit: true });
  if (saved.status !== 200) throw new Error(`save failed: ${JSON.stringify(saved.body)}`);
  const a = admin ?? (await adminClient());
  const review = await a.post('/api/admin/review', { uid: f.id, decision: 'approve' });
  if (review.status !== 200) throw new Error('approve failed');
  return f;
}

/** Client and freelancer with an accepted connection and an open thread. */
export async function connectedPair() {
  const admin = await adminClient();
  const f = await liveFreelancer('free@bench.test', {}, admin);
  const c = await signUp('client', 'client@bench.test', 'Jordan Lee');
  const conn = await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hi Alex, we would love your help with a project.' });
  if (conn.status !== 200) throw new Error(`connect failed: ${JSON.stringify(conn.body)}`);
  const accepted = await f.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: 'accept' });
  return { admin, f, c, connectionId: conn.body.connectionId as string, threadId: accepted.body.threadId as string };
}
