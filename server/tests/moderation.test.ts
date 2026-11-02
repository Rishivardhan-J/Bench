import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client.ts';
import { PROFILE_DRAFT, adminClient, closeApp, getApp, liveFreelancer, resetDb, signUp } from './helpers.ts';

beforeEach(async () => {
  await getApp();
  await resetDb();
});
afterAll(closeApp);

describe('profile moderation', () => {
  it('keeps a new profile out of search until an admin approves it', async () => {
    const f = await signUp('freelancer', 'new@bench.test');
    const saved = await f.client.put('/api/me/freelancer', { draft: PROFILE_DRAFT, submit: true });
    expect(saved.body).toEqual({ status: 'pending', wentOffline: false });
    expect((await f.client.get('/api/freelancers')).body.freelancers).toHaveLength(0);
    expect((await f.client.get(`/api/freelancers/${f.id}`)).status).toBe(200); // the owner can always see it
    const visitor = (await signUp('client', 'c@bench.test')).client;
    expect((await visitor.get(`/api/freelancers/${f.id}`)).status).toBe(404);

    const admin = await adminClient();
    expect((await admin.get('/api/admin/pending')).body.freelancers.map((x: { id: string }) => x.id)).toEqual([f.id]);
    await admin.post('/api/admin/review', { uid: f.id, decision: 'approve' });
    expect((await visitor.get('/api/freelancers')).body.freelancers.map((x: { id: string }) => x.id)).toEqual([f.id]);
  });

  it('returns a live profile to review when a core field changes, but not for availability', async () => {
    const f = await liveFreelancer('live@bench.test');
    const avail = await f.client.put('/api/me/freelancer', { draft: { ...PROFILE_DRAFT, availability: 'busy' } });
    expect(avail.body).toEqual({ status: 'approved', wentOffline: false });
    expect((await pool.query('SELECT approved FROM freelancer_profiles WHERE user_id = $1', [f.id])).rows[0].approved).toBe(true);

    const bio = await f.client.put('/api/me/freelancer', { draft: { ...PROFILE_DRAFT, availability: 'busy', headline: 'Something new here' } });
    expect(bio.body).toEqual({ status: 'pending', wentOffline: true });
    const row = (await pool.query('SELECT approved, review_status FROM freelancer_profiles WHERE user_id = $1', [f.id])).rows[0];
    expect(row).toEqual({ approved: false, review_status: 'pending' });
  });

  it('ignores server-owned fields sent by the owner', async () => {
    const f = await signUp('freelancer', 'sneaky@bench.test');
    await f.client.put('/api/me/freelancer', { draft: { ...PROFILE_DRAFT, approved: true, verified: true, ratingAvg: 5, reviewCount: 99, reviewStatus: 'approved' }, submit: false });
    const row = (await pool.query('SELECT approved, verified, rating_avg, review_count, review_status FROM freelancer_profiles WHERE user_id = $1', [f.id])).rows[0];
    expect(row).toEqual({ approved: false, verified: false, rating_avg: null, review_count: 0, review_status: 'draft' });
  });

  it('rejects images that are not the owner\'s own uploads and bad rate ranges', async () => {
    const f = await signUp('freelancer', 'bad@bench.test');
    const foreign = await f.client.put('/api/me/freelancer', { draft: { ...PROFILE_DRAFT, avatarUrl: 'https://tracker.example/pixel.png' } });
    expect(foreign.status).toBe(400);
    const rate = await f.client.put('/api/me/freelancer', { draft: { ...PROFILE_DRAFT, rateMin: 200, rateMax: 100 } });
    expect(rate.status).toBe(400);
  });

  it('requests changes with a reason and tells the freelancer', async () => {
    const f = await signUp('freelancer', 'chg@bench.test');
    await f.client.put('/api/me/freelancer', { draft: PROFILE_DRAFT, submit: true });
    const admin = await adminClient();
    expect((await admin.post('/api/admin/review', { uid: f.id, decision: 'request_changes' })).status).toBe(400);
    await admin.post('/api/admin/review', { uid: f.id, decision: 'request_changes', note: 'Add a portfolio link.' });
    const own = (await f.client.get('/api/me/freelancer')).body.freelancer;
    expect(own).toMatchObject({ reviewStatus: 'changes_requested', reviewNote: 'Add a portfolio link.' });
    const notes = (await f.client.get('/api/notifications')).body.notifications;
    expect(notes.map((n: { title: string }) => n.title)).toContain('Changes requested on your profile');
  });

  it('keeps moderation actions admin-only', async () => {
    const f = await signUp('freelancer', 'x@bench.test');
    const c = await signUp('client', 'y@bench.test');
    for (const who of [f.client, c.client]) {
      expect((await who.post('/api/admin/review', { uid: f.id, decision: 'approve' })).status).toBe(403);
      expect((await who.post('/api/admin/verify', { uid: f.id, verified: true })).status).toBe(403);
      expect((await who.get('/api/admin/reports')).status).toBe(403);
      expect((await who.post('/api/admin/lookup', { email: 'x@bench.test' })).status).toBe(403);
    }
  });

  it('alerts clients whose saved search matches a profile that goes live', async () => {
    const c = await signUp('client', 'alert@bench.test');
    await c.client.post('/api/saved-searches', { label: 'Designers', query: '', filters: { skills: ['Figma'] } });
    await c.client.post('/api/saved-searches', { label: 'Anyone', query: '', filters: {} });
    await liveFreelancer('match@bench.test');
    const notes = (await c.client.get('/api/notifications')).body.notifications;
    expect(notes.filter((n: { type: string }) => n.type === 'search_alert')).toHaveLength(1);
    const mail = (await pool.query(`SELECT subject FROM mail_outbox WHERE to_email = 'alert@bench.test'`)).rows;
    expect(mail.map((m) => m.subject)).toContain('A new match for your saved search on Bench');
  });

  it('suspends a reported profile', async () => {
    const f = await liveFreelancer('bad2@bench.test');
    const c = await signUp('client', 'rep@bench.test');
    expect((await c.client.post('/api/reports', { targetType: 'profile', targetId: f.id, reason: 'Looks fake' })).status).toBe(200);
    const admin = await adminClient();
    const [report] = (await admin.get('/api/admin/reports')).body.reports;
    await admin.post(`/api/admin/reports/${report.id}/resolve`, { suspend: true });
    expect((await c.client.get('/api/freelancers')).body.freelancers).toHaveLength(0);
    expect((await admin.get('/api/admin/reports')).body.reports).toHaveLength(0);
  });
});
