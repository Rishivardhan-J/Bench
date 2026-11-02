import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client.ts';
import { expireStaleRequests } from '../src/lib/jobs.ts';
import { PROFILE_DRAFT, adminClient, closeApp, connectedPair, getApp, liveFreelancer, resetDb, signUp } from './helpers.ts';

beforeEach(async () => {
  await getApp();
  await resetDb();
});
afterAll(closeApp);

describe('connect requests', () => {
  it('opens a private thread only after the freelancer accepts', async () => {
    const admin = await adminClient();
    const f = await liveFreelancer('f@bench.test', {}, admin);
    const c = await signUp('client', 'c@bench.test', 'Jordan Lee');
    const conn = await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hi Alex, can you help us out?' });
    expect(conn.status).toBe(200);
    expect((await c.client.get('/api/threads')).body.threads).toHaveLength(0);

    const incoming = (await f.client.get('/api/connections?as=in')).body.connections;
    expect(incoming[0]).toMatchObject({ status: 'pending', clientName: 'Jordan Lee', freelancerName: 'Alex Rivera' });

    const accepted = await f.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: 'accept' });
    expect(accepted.body.status).toBe('accepted');
    const threads = (await c.client.get('/api/threads')).body.threads;
    expect(threads).toHaveLength(1);
    expect(threads[0].participants.sort()).toEqual([c.id, f.id].sort());
    expect(threads[0].names[f.id]).toBe('Alex Rivera');
    const msgs = (await c.client.get(`/api/threads/${threads[0].id}/messages`)).body.messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('Hi Alex, can you help us out?');
  });

  it('limits new clients to three requests a day, even when sent in parallel', async () => {
    const admin = await adminClient();
    const people = [];
    for (let i = 0; i < 6; i++) people.push(await liveFreelancer(`f${i}@bench.test`, {}, admin));
    const c = await signUp('client', 'c@bench.test');
    const results = await Promise.all(people.map((f) => c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello there, are you free?' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.status === 429)).toHaveLength(3);
  });

  it('refuses duplicate, self and blocked requests with the same neutral message', async () => {
    const { f, c } = await connectedPair();
    const dup = await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello again, quick question.' });
    expect(dup.body.error.code).toBe('already-exists');
    expect((await c.client.post('/api/connections', { freelancerUid: c.id, message: 'Talking to myself here.' })).status).toBe(400);

    const other = await signUp('client', 'other@bench.test');
    await other.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello there, are you free?' });
    const conn = (await f.client.get('/api/connections?as=in')).body.connections.find((x: { clientUid: string }) => x.clientUid === other.id);
    await f.client.post(`/api/connections/${conn.id}/respond`, { action: 'block' });
    const again = await other.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello again, sorry to bother.' });
    expect(again.status).toBe(412);
    expect(again.body.error.message).toBe("This freelancer isn't accepting requests right now.");
  });

  it('lets a freelancer decline with a reason and recommend someone else (warm pass)', async () => {
    const admin = await adminClient();
    const busy = await liveFreelancer('busy@bench.test', {}, admin);
    const friend = await liveFreelancer('friend@bench.test', { name: 'Sam Okafor' }, admin);
    const c = await signUp('client', 'c@bench.test');
    const conn = await c.client.post('/api/connections', { freelancerUid: busy.id, message: 'Hello there, are you free?' });
    expect((await busy.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: 'decline', reason: 'booked', referTo: 'nobody' })).status).toBe(400);
    const res = await busy.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: 'decline', reason: 'booked', referTo: friend.id });
    expect(res.body.status).toBe('declined');
    const out = (await c.client.get('/api/connections?as=out')).body.connections[0];
    expect(out).toMatchObject({ status: 'declined', declineReason: 'booked', referredFreelancerId: friend.id, referredName: 'Sam Okafor' });
    const notes = (await c.client.get('/api/notifications')).body.notifications;
    expect(notes.some((n: { type: string }) => n.type === 'request_declined')).toBe(true);
    // The cooldown stops an immediate retry.
    expect((await c.client.post('/api/connections', { freelancerUid: busy.id, message: 'Hello again, one more try.' })).status).toBe(412);
  });

  it('expires requests nobody answers, tells the client, and allows a fresh request', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test');
    const conn = await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello there, are you free?' });
    expect(await expireStaleRequests()).toBe(0);
    await pool.query(`UPDATE connections SET created_at = now() - interval '6 days' WHERE id = $1`, [conn.body.connectionId]);
    expect(await expireStaleRequests()).toBe(1);
    expect((await c.client.get('/api/connections?as=out')).body.connections[0].status).toBe('expired');
    expect((await c.client.get('/api/notifications')).body.notifications.some((n: { type: string }) => n.type === 'request_expired')).toBe(true);
    expect((await f.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: 'accept' })).status).toBe(412);
    expect((await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello again, sorry for the wait.' })).status).toBe(200);
  });
});

describe('messaging', () => {
  it('delivers messages, counts unread and clears them on read', async () => {
    const { f, c, threadId } = await connectedPair();
    const sent = await c.client.post(`/api/threads/${threadId}/messages`, { text: 'Are you free on Monday?' });
    expect(sent.status).toBe(200);
    let fthreads = (await f.client.get('/api/threads')).body.threads;
    expect(fthreads[0].unread[f.id]).toBe(2); // the connect message plus this one
    expect(fthreads[0].lastMessage).toBe('Are you free on Monday?');
    await f.client.post(`/api/threads/${threadId}/read`);
    fthreads = (await f.client.get('/api/threads')).body.threads;
    expect(fthreads[0].unread[f.id]).toBe(0);
    expect(fthreads[0].lastRead[f.id]).toBeGreaterThan(0);
    // Already-unread threads don't notify again; once read, the next message does.
    expect((await f.client.get('/api/notifications')).body.notifications.some((n: { type: string }) => n.type === 'new_message')).toBe(false);
    await c.client.post(`/api/threads/${threadId}/messages`, { text: 'Also, could you send a quote?' });
    const notes = (await f.client.get('/api/notifications')).body.notifications;
    expect(notes.filter((n: { type: string }) => n.type === 'new_message')).toHaveLength(1);
    const mail = await pool.query(`SELECT subject FROM mail_outbox WHERE subject LIKE 'New message%'`);
    expect(mail.rowCount).toBe(1);
  });

  it('lets only the two participants read or write a thread', async () => {
    const { threadId } = await connectedPair();
    const stranger = await signUp('client', 'stranger@bench.test');
    const admin = await adminClient();
    for (const who of [stranger.client, admin]) {
      expect((await who.get(`/api/threads/${threadId}/messages`)).status).toBe(404);
      expect((await who.post(`/api/threads/${threadId}/messages`, { text: 'Hello from outside' })).status).toBe(404);
      expect((await who.post(`/api/threads/${threadId}/read`)).status).toBe(404);
    }
    expect((await stranger.client.get('/api/threads')).body.threads).toHaveLength(0);
  });

  it('caps messages to a contact who has not replied, and counts the first reply as response time', async () => {
    const { f, c, threadId } = await connectedPair();
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await c.client.post(`/api/threads/${threadId}/messages`, { text: `Following up number ${i}` })).status);
    expect(results.filter((s) => s === 200)).toHaveLength(5);
    expect(results.at(-1)).toBe(429);
    await f.client.post(`/api/threads/${threadId}/messages`, { text: 'Sorry for the delay.' });
    expect((await c.client.post(`/api/threads/${threadId}/messages`, { text: 'No problem at all' })).status).toBe(200);
    const row = (await pool.query('SELECT reply_count, avg_response_minutes FROM freelancer_profiles WHERE user_id = $1', [f.id])).rows[0];
    expect(row.reply_count).toBe(1);
    expect(row.avg_response_minutes).toBeNull(); // hidden until a few real replies
  });

  it('warns on off-platform contact in the first exchange unless the sender confirms', async () => {
    const { c, threadId } = await connectedPair();
    const warn = await c.client.post(`/api/threads/${threadId}/messages`, { text: 'Call me on +1 415 555 0132' });
    expect(warn.status).toBe(412);
    expect(warn.body.error.details).toEqual({ offPlatform: 'phone' });
    expect((await c.client.post(`/api/threads/${threadId}/messages`, { text: 'Call me on +1 415 555 0132', confirmOffPlatform: true })).status).toBe(200);
  });

  it('closes a conversation when someone is blocked', async () => {
    const { f, c, threadId } = await connectedPair();
    await f.client.post('/api/blocks', { targetUid: c.id });
    expect((await c.client.post(`/api/threads/${threadId}/messages`, { text: 'Hello? Anyone there?' })).status).toBe(412);
    const status = (await pool.query(`SELECT status FROM connections WHERE client_id = $1`, [c.id])).rows[0].status;
    expect(status).toBe('blocked');
  });
});

describe('hires, reviews and ratings', () => {
  it('needs an accepted request, a real conversation and a marked hire', async () => {
    const admin = await adminClient();
    const f = await liveFreelancer('f@bench.test', {}, admin);
    const c = await signUp('client', 'c@bench.test');
    expect((await c.client.post('/api/hires', { freelancerUid: f.id })).status).toBe(412);

    const conn = await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello there, are you free?' });
    const { body } = await f.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: 'accept' });
    const hire = await c.client.post('/api/hires', { freelancerUid: f.id });
    expect(hire.status).toBe(200);
    expect((await c.client.post('/api/hires', { freelancerUid: f.id })).body.hireId).toBe(hire.body.hireId);

    const early = await c.client.post('/api/reviews', { hireId: hire.body.hireId, rating: 5, text: 'Wonderful to work with.' });
    expect(early.status).toBe(412);

    await c.client.post(`/api/threads/${body.threadId}/messages`, { text: 'Thanks for accepting' });
    await f.client.post(`/api/threads/${body.threadId}/messages`, { text: 'Happy to help!' });
    const review = await c.client.post('/api/reviews', { hireId: hire.body.hireId, rating: 4, text: 'Wonderful to work with.' });
    expect(review.status).toBe(200);
    expect((await c.client.post('/api/reviews', { hireId: hire.body.hireId, rating: 5, text: 'Trying to review twice.' })).status).toBe(409);

    const profile = (await c.client.get(`/api/freelancers/${f.id}`)).body.freelancer;
    expect(profile).toMatchObject({ ratingAvg: 4, reviewCount: 1 });
    const reviews = (await c.client.get(`/api/freelancers/${f.id}/reviews`)).body.reviews;
    expect(reviews[0]).toMatchObject({ rating: 4, clientName: 'Test P.', freelancerUid: f.id });

    expect((await f.client.post(`/api/reviews/${review.body.reviewId}/reply`, { text: 'Thank you!' })).status).toBe(200);
    expect((await f.client.post(`/api/reviews/${review.body.reviewId}/reply`, { text: 'Again!' })).status).toBe(409);
    const stranger = await signUp('freelancer', 'other@bench.test');
    expect((await stranger.client.post(`/api/reviews/${review.body.reviewId}/reply`, { text: 'Not mine' })).status).toBe(404);
  });

  it('allows only one review per engagement under parallel requests', async () => {
    const { f, c, threadId } = await connectedPair();
    await c.client.post(`/api/threads/${threadId}/messages`, { text: 'Thanks for accepting' });
    await f.client.post(`/api/threads/${threadId}/messages`, { text: 'Happy to help!' });
    const { body } = await c.client.post('/api/hires', { freelancerUid: f.id });
    const results = await Promise.all(Array.from({ length: 5 }, () => c.client.post('/api/reviews', { hireId: body.hireId, rating: 5, text: 'Exceptional work throughout.' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM reviews')).rows[0].n).toBe(1);
  });

  it('keeps a freelancer from reviewing or hiring, and a client from replying', async () => {
    const { f, c } = await connectedPair();
    expect((await f.client.post('/api/hires', { freelancerUid: f.id })).status).toBe(403);
    expect((await c.client.post('/api/reviews/x/reply', { text: 'I am a client' })).status).toBe(403);
  });

  it('shows a track record only once there are enough requests', async () => {
    const admin = await adminClient();
    const f = await liveFreelancer('f@bench.test', {}, admin);
    const visitor = await signUp('client', 'v@bench.test');
    expect((await visitor.client.get(`/api/freelancers/${f.id}/track-record`)).body.visible).toBe(false);
    for (let i = 0; i < 3; i++) {
      const c = await signUp('client', `c${i}@bench.test`);
      const conn = await c.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello there, are you free?' });
      await f.client.post(`/api/connections/${conn.body.connectionId}/respond`, { action: i === 0 ? 'accept' : 'decline', reason: 'booked' });
      if (i === 0) await c.client.post('/api/hires', { freelancerUid: f.id });
    }
    const record = (await visitor.client.get(`/api/freelancers/${f.id}/track-record`)).body;
    expect(record).toMatchObject({ visible: true, requests: 3, answered: 3, hires: 1, repeatClients: 0 });
    // Not available for a profile that is not live.
    const draft = await signUp('freelancer', 'd@bench.test');
    await draft.client.put('/api/me/freelancer', { draft: PROFILE_DRAFT, submit: false });
    expect((await visitor.client.get(`/api/freelancers/${draft.id}/track-record`)).status).toBe(404);
  });
});
