import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client.ts';
import { storage } from '../src/lib/storage.ts';
import { pdfText } from '../src/modules/ai.ts';
import { Client, adminClient, closeApp, connectedPair, getApp, liveFreelancer, resetDb, signUp } from './helpers.ts';

beforeEach(async () => {
  await getApp();
  await resetDb();
});
afterAll(closeApp);

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');

/** A one-page PDF whose text layer says `text`. */
function pdfWith(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

describe('access control', () => {
  it('keeps shortlists private to their client', async () => {
    const f = await liveFreelancer('f@bench.test');
    const a = await signUp('client', 'a@bench.test');
    const b = await signUp('client', 'b@bench.test');
    const { body } = await a.client.post('/api/shortlists', { name: 'Designers', freelancerId: f.id });
    expect((await b.client.get('/api/shortlists')).body.lists).toHaveLength(0);
    for (const attempt of [
      b.client.patch(`/api/shortlists/${body.id}`, { name: 'Mine now' }),
      b.client.put(`/api/shortlists/${body.id}/items/${f.id}`),
      b.client.del(`/api/shortlists/${body.id}`),
      b.client.post(`/api/shortlists/${body.id}/share`),
    ]) expect((await attempt).status).toBe(404);
    expect((await f.client.get('/api/shortlists')).status).toBe(403); // a freelancer has no shortlists
  });

  it('shares a shortlist through a revocable link that never includes private notes', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test');
    const { body } = await c.client.post('/api/shortlists', { name: 'Finalists', freelancerId: f.id });
    await c.client.patch(`/api/shortlists/${body.id}/items/${f.id}`, { note: 'Too pricey, but great portfolio' });
    const { token } = (await c.client.post(`/api/shortlists/${body.id}/share`)).body;
    expect((await c.client.post(`/api/shortlists/${body.id}/share`)).body.token).toBe(token);

    const visitor = new Client();
    const shared = await visitor.get(`/api/shared/${token}`);
    expect(shared.status).toBe(200);
    expect(shared.body.name).toBe('Finalists');
    expect(shared.body.freelancers.map((x: { id: string }) => x.id)).toEqual([f.id]);
    expect(JSON.stringify(shared.body)).not.toContain('pricey');
    expect(Object.keys(shared.body.freelancers[0])).not.toContain('reviewNote');

    expect((await visitor.get('/api/shared/not-a-real-token-at-all')).status).toBe(404);
    await c.client.del(`/api/shortlists/${body.id}/share`);
    expect((await visitor.get(`/api/shared/${token}`)).status).toBe(404);
    expect((await c.client.post(`/api/shortlists/${body.id}/share`)).body.token).not.toBe(token);
  });

  it('only shows people who are still live in a shared list', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test');
    const { body } = await c.client.post('/api/shortlists', { name: 'L', freelancerId: f.id });
    const { token } = (await c.client.post(`/api/shortlists/${body.id}/share`)).body;
    await f.client.put('/api/me/freelancer/paused', { paused: true });
    expect((await new Client().get(`/api/shared/${token}`)).body.freelancers).toHaveLength(0);
  });

  it('keeps client pages and freelancer pages apart', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test');
    expect((await f.client.post('/api/connections', { freelancerUid: f.id, message: 'Hello to myself' })).status).toBe(403);
    expect((await f.client.post('/api/projects', { title: 'Nope' })).status).toBe(403);
    expect((await c.client.get('/api/me/freelancer')).status).toBe(403);
    expect((await c.client.put('/api/me/freelancer', {})).status).toBe(403);
    expect((await c.client.get('/api/proposals/mine')).status).toBe(403);
    expect((await new Client().get('/api/threads')).status).toBe(401);
    expect((await new Client().post("/api/saved-searches", { label: "x" })).status).toBe(401);
  });

  it('serves public images openly, but resumes and attachments only to the right people', async () => {
    const { f, c, threadId } = await connectedPair();
    const stranger = await signUp('client', 'stranger@bench.test');
    const admin = await adminClient();

    const avatar = await f.client.upload('/api/files/avatars', PNG, 'me.png', 'image/png');
    expect(avatar.status).toBe(200);
    expect(avatar.body.url).toMatch(new RegExp(`^/api/files/public/avatars/${f.id}/`));
    const shown = await new Client().get(avatar.body.url);
    expect(shown.status).toBe(200);
    expect(shown.headers['content-type']).toBe('image/png');
    expect(shown.headers['x-content-type-options']).toBe('nosniff');

    const resume = await f.client.upload('/api/files/resumes', pdfWith('Alex Rivera Figma'), 'cv.pdf', 'application/pdf');
    expect(resume.body.path).toBe(`resumes/${f.id}/resume.pdf`);
    expect((await f.client.get(`/api/files/${resume.body.path}`)).status).toBe(200);
    expect((await admin.get(`/api/files/${resume.body.path}`)).status).toBe(200);
    expect((await c.client.get(`/api/files/${resume.body.path}`)).status).toBe(404);
    expect((await new Client().get(`/api/files/${resume.body.path}`)).status).toBe(401);

    const att = await c.client.upload(`/api/threads/${threadId}/attachments`, Buffer.from('brief: build things\n'), 'brief.txt', 'text/plain');
    expect(att.status).toBe(200);
    expect(att.body).toMatchObject({ name: 'brief.txt', type: 'text/plain', url: `/api/files/${att.body.path}` });
    expect((await f.client.get(att.body.url)).status).toBe(200);
    expect((await stranger.client.get(att.body.url)).status).toBe(404);
    expect((await stranger.client.upload(`/api/threads/${threadId}/attachments`, PNG, 'x.png')).status).toBe(404);

    // Attachments can only be sent from this thread's own folder.
    const forged = await c.client.post(`/api/threads/${threadId}/messages`, { text: 'see this', attachments: [{ path: `resumes/${f.id}/resume.pdf`, name: 'cv.pdf' }] });
    expect(forged.status).toBe(400);
    const sent = await c.client.post(`/api/threads/${threadId}/messages`, { text: 'see this', attachments: [{ path: att.body.path, name: 'brief.txt', size: 20 }] });
    expect(sent.status).toBe(200);
    expect(sent.body.message.attachments[0].url).toBe(att.body.url);
  });

  it('judges uploads by their content, not their name or declared type', async () => {
    const f = await signUp('freelancer', 'f@bench.test');
    expect((await f.client.upload('/api/files/avatars', Buffer.from('#!/bin/sh\necho hi\n'), 'me.png', 'image/png')).status).toBe(400);
    expect((await f.client.upload('/api/files/avatars', Buffer.from('<svg onload=alert(1)></svg>'), 'me.png', 'image/png')).status).toBe(400);
    expect((await f.client.upload('/api/files/resumes', PNG, 'cv.pdf', 'application/pdf')).status).toBe(400);
    expect((await f.client.upload('/api/files/avatars', Buffer.alloc(6 * 1024 * 1024, 1), 'big.png', 'image/png')).status).toBe(400);
    expect((await f.client.upload('/api/files/avatars', Buffer.alloc(0), 'empty.png', 'image/png')).status).toBe(400);
  });
});

describe('resume reading', () => {
  it('extracts text from a real PDF', async () => {
    expect(await pdfText(pdfWith('Senior designer with Figma and Prototyping'))).toContain('Figma');
  });

  it('suggests skills from an uploaded resume without needing an AI key', async () => {
    const f = await signUp('freelancer', 'f@bench.test');
    expect((await f.client.post('/api/ai/resume')).status).toBe(400); // nothing uploaded yet
    await f.client.upload('/api/files/resumes', pdfWith('Jamie Chen. Senior developer. React, TypeScript, PostgreSQL and Docker.'), 'cv.pdf', 'application/pdf');
    const res = await f.client.post('/api/ai/resume');
    expect(res.status).toBe(200);
    expect(res.body.suggestions.skills).toEqual(expect.arrayContaining(['React', 'TypeScript', 'PostgreSQL', 'Docker']));
    // Suggestions are never saved without confirmation.
    expect((await pool.query('SELECT skills FROM freelancer_profiles WHERE user_id = $1', [f.id])).rows[0].skills).toEqual([]);
    expect((await new Client().post('/api/ai/resume')).status).toBe(401);
  });

  it('answers AI features with a clear "not configured" error so the client falls back locally', async () => {
    const res = await new Client().post('/api/ai/extract-brief', { brief: 'Need a senior React developer' });
    expect(res.status).toBe(412);
    expect(res.body.error.code).toBe('failed-precondition');
    const f = await liveFreelancer('f@bench.test');
    const summary = await new Client().post('/api/ai/review-summary', { freelancerId: f.id });
    expect(summary.body.summary).toMatch(/Not enough reviews/);
    await storage.remove(`resumes/${f.id}/resume.pdf`);
  });
});

describe('projects and proposals', () => {
  it('takes names and titles from the database, never from the caller', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test', 'Jordan Lee');
    const { body } = await c.client.post('/api/projects', { title: 'Build a site', description: 'Pages', skills: ['Figma'], budgetMin: 10, budgetMax: 50, timeline: '6 weeks', clientName: 'The CEO of Google' });
    const project = (await c.client.get(`/api/projects/${body.projectId}`)).body.project;
    expect(project.clientName).toBe('Jordan Lee');

    expect((await f.client.post(`/api/projects/${body.projectId}/proposals`, { message: 'I can do this', rate: 90, freelancerName: 'Elon' })).status).toBe(200);
    const mine = (await f.client.get('/api/proposals/mine')).body.proposals[0];
    expect(mine).toMatchObject({ freelancerName: 'Alex Rivera', projectTitle: 'Build a site', status: 'sent' });
    expect((await f.client.post(`/api/projects/${body.projectId}/proposals`, { message: 'Again', rate: 90 })).status).toBe(409);
    const notes = (await c.client.get('/api/notifications')).body.notifications;
    expect(notes.some((n: { type: string }) => n.type === 'proposal_received')).toBe(true);
    expect((await f.client.get('/api/notifications')).body.notifications.some((n: { type: string }) => n.type === 'project_match')).toBe(true);
  });

  it('keeps proposals private to the client and the freelancer, and opens a thread on choice', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test', 'Jordan Lee');
    const other = await signUp('client', 'o@bench.test');
    const { body } = await c.client.post('/api/projects', { title: 'Build a site', skills: ['React'] });
    await f.client.post(`/api/projects/${body.projectId}/proposals`, { message: 'I can do this', rate: 90 });
    expect((await other.client.get(`/api/projects/${body.projectId}/proposals`)).body.proposals).toHaveLength(0);
    const [proposal] = (await c.client.get(`/api/projects/${body.projectId}/proposals`)).body.proposals;
    expect((await other.client.patch(`/api/proposals/${proposal.id}`, { status: 'declined' })).status).toBe(404);
    expect((await other.client.post(`/api/proposals/${proposal.id}/open-thread`)).status).toBe(404);

    const opened = await c.client.post(`/api/proposals/${proposal.id}/open-thread`);
    expect(opened.status).toBe(200);
    expect((await f.client.get('/api/threads')).body.threads[0].id).toBe(opened.body.threadId);
    expect((await c.client.post(`/api/proposals/${proposal.id}/open-thread`)).body.threadId).toBe(opened.body.threadId);
    expect((await c.client.get('/api/projects/' + body.projectId + '/proposals')).body.proposals[0].status).toBe('chosen');
  });

  it('refuses proposals from blocked freelancers and on closed projects', async () => {
    const f = await liveFreelancer('f@bench.test');
    const c = await signUp('client', 'c@bench.test');
    const { body } = await c.client.post('/api/projects', { title: 'Build a site', skills: ['React'] });
    await c.client.post('/api/blocks', { targetUid: f.id });
    expect((await f.client.post(`/api/projects/${body.projectId}/proposals`, { message: 'Hi there', rate: 90 })).status).toBe(412);
    await c.client.patch(`/api/projects/${body.projectId}`, { status: 'closed' });
    const g = await liveFreelancer('g@bench.test');
    expect((await g.client.post(`/api/projects/${body.projectId}/proposals`, { message: 'Hi there', rate: 90 })).status).toBe(412);
    expect((await g.client.get(`/api/projects/${body.projectId}`)).status).toBe(404); // closed projects are the owner's only
  });
});
