import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client.ts';
import { Client, closeApp, getApp, liveFreelancer, resetDb, signUp } from './helpers.ts';

beforeEach(async () => {
  await getApp();
  await resetDb();
});
afterAll(closeApp);

describe('accounts', () => {
  it('signs up, restores the session, signs out', async () => {
    const { client, id } = await signUp('client', 'a@bench.test', 'Jordan Lee');
    const me = await client.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ id, email: 'a@bench.test', role: 'client', isAdmin: false, name: 'Jordan Lee' });
    await client.post('/api/auth/signout');
    expect((await client.get('/api/auth/me')).body.user).toBeNull();
  });

  it('allows one email to hold only one account, with a clear message', async () => {
    await signUp('client', 'dup@bench.test');
    const res = await new Client().post('/api/auth/signup', { email: 'DUP@bench.test', password: 'password123', role: 'freelancer', name: 'X' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already-exists');
    expect(res.body.error.message).toMatch(/one email can hold only one account type/i);
  });

  it('rejects wrong passwords without revealing whether the email exists', async () => {
    await signUp('client', 'real@bench.test');
    const wrong = await new Client().post('/api/auth/signin', { email: 'real@bench.test', password: 'nope-nope-1' });
    const unknown = await new Client().post('/api/auth/signin', { email: 'ghost@bench.test', password: 'nope-nope-1' });
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('never stores or returns a role chosen after sign-up', async () => {
    const { client } = await signUp('client', 'role@bench.test');
    const res = await client.post('/api/auth/signup', { email: 'x@bench.test', password: 'password123', role: 'admin' });
    expect(res.status).toBe(400);
    const row = (await pool.query(`SELECT role, is_admin FROM users WHERE email = 'role@bench.test'`)).rows[0];
    expect(row).toEqual({ role: 'client', is_admin: false });
  });

  it('blocks state-changing requests from other origins', async () => {
    const res = await new Client('https://evil.example').post('/api/auth/signin', { email: 'a@bench.test', password: 'password123' });
    expect(res.status).toBe(403);
    expect((await new Client(null).post('/api/auth/signout')).status).toBe(403);
  });

  it('rate limits sign-ups per network', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await new Client().post('/api/auth/signup', { email: `u${i}@bench.test`, password: 'password123', role: 'client' })).status;
    expect(last).toBe(429);
  });

  it('resets a password by email and signs everyone out', async () => {
    const { client } = await signUp('client', 'reset@bench.test');
    await new Client().post('/api/auth/reset-request', { email: 'reset@bench.test' });
    const unknown = await new Client().post('/api/auth/reset-request', { email: 'nobody@bench.test' });
    expect(unknown.status).toBe(200);
    const mail = (await pool.query(`SELECT body FROM mail_outbox WHERE to_email = 'reset@bench.test'`)).rows;
    expect(mail).toHaveLength(1);
    const token = mail[0].body.match(/token=([\w-]+)/)[1];
    expect((await new Client().post('/api/auth/reset-confirm', { token, password: 'new-password-1' })).status).toBe(200);
    expect((await new Client().post('/api/auth/reset-confirm', { token, password: 'new-password-2' })).status).toBe(412);
    expect((await client.get('/api/auth/me')).body.user).toBeNull();
    expect((await new Client().post('/api/auth/signin', { email: 'reset@bench.test', password: 'new-password-1' })).status).toBe(200);
  });

  it('deletes an account with its data, and keeps anonymised reviews written by a deleted client', async () => {
    const f = await liveFreelancer('f@bench.test');
    const { client, id } = await signUp('client', 'gone@bench.test', 'Jordan Lee');
    await client.post('/api/shortlists', { name: 'List', freelancerId: f.id });
    await pool.query(`INSERT INTO hires (id, client_id, freelancer_id) VALUES ('h1', $1, $2)`, [id, f.id]);
    await pool.query(`INSERT INTO reviews (id, hire_id, client_id, client_name, freelancer_id, rating, text) VALUES ('h1', 'h1', $1, 'Jordan L.', $2, 5, 'Great work all round.')`, [id, f.id]);
    expect((await client.del('/api/account')).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM users WHERE id = $1', [id])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM shortlists WHERE client_id = $1', [id])).rowCount).toBe(0);
    const review = (await pool.query(`SELECT client_id FROM reviews WHERE id = 'h1'`)).rows[0];
    expect(review.client_id).toBeNull();
  });
});
