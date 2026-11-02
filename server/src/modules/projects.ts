import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one, pool, tx } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { emit } from '../lib/events.ts';
import { compact, isBlockedEitherWay, ms } from '../lib/guards.ts';
import { notify } from '../lib/notify.ts';
import { requireAuth, requireRole } from '../lib/session.ts';
import { createThread } from '../lib/threads.ts';
import { id as idSchema, parse, text } from '../lib/validate.ts';

const PROJECT_SQL = `
  SELECT p.id, p.client_id AS "clientUid", cp.name AS "clientName", p.title, p.description, p.skills,
         p.budget_min AS "budgetMin", p.budget_max AS "budgetMax", p.timeline, p.status, ${ms('p.created_at')} AS "createdAt"
  FROM projects p LEFT JOIN client_profiles cp ON cp.user_id = p.client_id`;

const PROPOSAL_SQL = `
  SELECT pr.id, pr.project_id AS "projectId", pj.title AS "projectTitle", pr.client_id AS "clientUid", pr.freelancer_id AS "freelancerUid",
         fp.name AS "freelancerName", pr.message, pr.rate, pr.status, pr.thread_id AS "threadId", ${ms('pr.created_at')} AS "createdAt"
  FROM proposals pr JOIN projects pj ON pj.id = pr.project_id LEFT JOIN freelancer_profiles fp ON fp.user_id = pr.freelancer_id`;

const projectInput = z
  .object({
    title: text(120, 'Title'),
    description: z.string().max(4000, 'Description must be 4,000 characters or fewer.').default(''),
    skills: z.array(z.string().trim().min(1).max(50)).max(15, 'Pick up to 15 skills.').default([]),
    budgetMin: z.number().min(0).max(1000000).default(0),
    budgetMax: z.number().min(0).max(1000000).default(0),
    timeline: z.string().max(60).default(''),
  })
  .refine((p) => p.budgetMax >= p.budgetMin, { message: 'The top of the budget must be at least the bottom.' });

export async function projectRoutes(app: FastifyInstance) {
  // Anyone signed in can browse open projects; clients also see their own closed ones.
  app.get('/api/projects', async (req) => {
    const user = requireAuth(req);
    const { scope } = parse(z.object({ scope: z.enum(['open', 'mine']).default('open') }), req.query);
    const rows =
      scope === 'mine'
        ? await many(pool, `${PROJECT_SQL} WHERE p.client_id = $1 ORDER BY p.created_at DESC LIMIT 100`, [user.id])
        : await many(pool, `${PROJECT_SQL} WHERE p.status = 'open' ORDER BY p.created_at DESC LIMIT 100`);
    return { projects: rows.map((r) => compact(r)) };
  });

  app.get('/api/projects/:id', async (req) => {
    const user = requireAuth(req);
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const row = await one<{ status: string; clientUid: string }>(pool, `${PROJECT_SQL} WHERE p.id = $1`, [id]);
    if (!row || (row.status !== 'open' && row.clientUid !== user.id && !user.isAdmin)) throw new ApiError('not-found', 'Project not found.');
    return { project: compact(row as Record<string, unknown>) };
  });

  app.post('/api/projects', async (req) => {
    const client = requireRole(req, 'client');
    const input = parse(projectInput, req.body);
    return tx(async (c) => {
      const projectId = (
        await c.query(
          `INSERT INTO projects (client_id, title, description, skills, budget_min, budget_max, timeline) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [client.id, input.title, input.description, input.skills, input.budgetMin, input.budgetMax, input.timeline],
        )
      ).rows[0].id as string;
      // Tell matching live freelancers (the first 50 with a shared skill).
      if (input.skills.length > 0) {
        const lower = input.skills.map((s) => s.toLowerCase());
        const matches = await many<{ user_id: string }>(
          c,
          `SELECT user_id FROM freelancer_profiles WHERE approved AND NOT paused
             AND EXISTS (SELECT 1 FROM unnest(skills) s WHERE lower(s) = ANY($1)) ORDER BY completeness DESC LIMIT 50`,
          [lower],
        );
        for (const m of matches) {
          await notify(c, m.user_id, { type: 'project_match', title: 'A new project matches your skills', body: input.title, link: '/freelancer/board', refId: projectId });
        }
      }
      await emit(c, '*', ['projects']);
      return { projectId };
    });
  });

  app.patch('/api/projects/:id', async (req) => {
    const client = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const patch = parse(
      z.object({
        title: text(120, 'Title').optional(),
        description: z.string().max(4000).optional(),
        skills: z.array(z.string().trim().min(1).max(50)).max(15).optional(),
        budgetMin: z.number().min(0).optional(),
        budgetMax: z.number().min(0).optional(),
        timeline: z.string().max(60).optional(),
        status: z.enum(['open', 'closed']).optional(),
      }),
      req.body,
    );
    await tx(async (c) => {
      const current = await one<Record<string, number>>(c, 'SELECT budget_min, budget_max FROM projects WHERE id = $1 AND client_id = $2 FOR UPDATE', [id, client.id]);
      if (!current) throw new ApiError('not-found', 'Project not found.');
      const min = patch.budgetMin ?? current.budget_min;
      const max = patch.budgetMax ?? current.budget_max;
      if (max < min) throw new ApiError('invalid-argument', 'The top of the budget must be at least the bottom.');
      await c.query(
        `UPDATE projects SET title = COALESCE($3, title), description = COALESCE($4, description), skills = COALESCE($5, skills),
           budget_min = $6, budget_max = $7, timeline = COALESCE($8, timeline), status = COALESCE($9, status) WHERE id = $1 AND client_id = $2`,
        [id, client.id, patch.title ?? null, patch.description ?? null, patch.skills ?? null, min, max, patch.timeline ?? null, patch.status ?? null],
      );
      await emit(c, '*', ['projects']);
    });
    return { ok: true };
  });

  app.delete('/api/projects/:id', async (req) => {
    const client = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await tx(async (c) => {
      const res = await c.query('DELETE FROM projects WHERE id = $1 AND client_id = $2', [id, client.id]);
      if (res.rowCount === 0) throw new ApiError('not-found', 'Project not found.');
      await emit(c, '*', ['projects', 'proposals']);
    });
    return { ok: true };
  });

  // Proposals --------------------------------------------------------------

  app.get('/api/projects/:id/proposals', async (req) => {
    const client = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const rows = await many(pool, `${PROPOSAL_SQL} WHERE pr.project_id = $1 AND pr.client_id = $2 ORDER BY pr.created_at DESC LIMIT 100`, [id, client.id]);
    return { proposals: rows.map((r) => compact(r)) };
  });

  app.get('/api/proposals/mine', async (req) => {
    const user = requireRole(req, 'freelancer');
    const rows = await many(pool, `${PROPOSAL_SQL} WHERE pr.freelancer_id = $1 ORDER BY pr.created_at DESC LIMIT 100`, [user.id]);
    return { proposals: rows.map((r) => compact(r)) };
  });

  app.post('/api/projects/:id/proposals', async (req) => {
    const freelancer = requireRole(req, 'freelancer');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const body = parse(z.object({ message: text(2000, 'Message'), rate: z.number({ error: 'Enter your hourly rate.' }).min(0).max(100000) }), req.body);
    return tx(async (c) => {
      const project = await one<{ client_id: string; title: string; status: string }>(c, 'SELECT client_id, title, status FROM projects WHERE id = $1', [id]);
      if (!project || project.status !== 'open') throw new ApiError('failed-precondition', 'This project is no longer open.');
      if (await isBlockedEitherWay(c, freelancer.id, project.client_id)) throw new ApiError('failed-precondition', "You can't send a proposal to this client.");
      const live = await one(c, 'SELECT 1 FROM freelancer_profiles WHERE user_id = $1 AND approved AND NOT paused', [freelancer.id]);
      if (!live) throw new ApiError('failed-precondition', 'Your profile must be live to send proposals.');
      const inserted = await one<{ id: string }>(
        c,
        `INSERT INTO proposals (project_id, client_id, freelancer_id, message, rate) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
        [id, project.client_id, freelancer.id, body.message, body.rate],
      );
      if (!inserted) throw new ApiError('already-exists', "You've already sent a proposal for this project.");
      const name = (await one<{ name: string }>(c, 'SELECT name FROM freelancer_profiles WHERE user_id = $1', [freelancer.id]))?.name || 'A freelancer';
      await notify(c, project.client_id, { type: 'proposal_received', title: `${name} sent a proposal`, body: project.title, link: `/projects/${id}`, refId: inserted.id });
      await emit(c, [project.client_id, freelancer.id], ['proposals']);
      return { proposalId: inserted.id };
    });
  });

  app.patch('/api/proposals/:id', async (req) => {
    const client = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const { status } = parse(z.object({ status: z.enum(['sent', 'shortlisted', 'declined']) }), req.body);
    await tx(async (c) => {
      const res = await one<{ freelancer_id: string }>(c, `UPDATE proposals SET status = $3 WHERE id = $1 AND client_id = $2 RETURNING freelancer_id`, [id, client.id, status]);
      if (!res) throw new ApiError('not-found', 'Proposal not found.');
      await emit(c, [client.id, res.freelancer_id], ['proposals']);
    });
    return { ok: true };
  });

  app.delete('/api/proposals/:id', async (req) => {
    const freelancer = requireRole(req, 'freelancer');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    await tx(async (c) => {
      const res = await one<{ client_id: string }>(c, 'DELETE FROM proposals WHERE id = $1 AND freelancer_id = $2 RETURNING client_id', [id, freelancer.id]);
      if (!res) throw new ApiError('not-found', 'Proposal not found.');
      await emit(c, [res.client_id, freelancer.id], ['proposals']);
    });
    return { ok: true };
  });

  app.post('/api/proposals/:id/open-thread', async (req) => {
    const client = requireRole(req, 'client');
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    return tx(async (c) => {
      const p = await one<{ freelancer_id: string; message: string; project_id: string; title: string }>(
        c,
        `SELECT pr.freelancer_id, pr.message, pr.project_id, pj.title FROM proposals pr JOIN projects pj ON pj.id = pr.project_id WHERE pr.id = $1 AND pr.client_id = $2 FOR UPDATE OF pr`,
        [id, client.id],
      );
      if (!p) throw new ApiError('not-found', 'Proposal not found.');
      if (await isBlockedEitherWay(c, client.id, p.freelancer_id)) throw new ApiError('failed-precondition', "This freelancer isn't available.");

      let conn = await one<{ id: string; thread_id: string | null }>(c, 'SELECT id, thread_id FROM connections WHERE client_id = $1 AND freelancer_id = $2 FOR UPDATE', [client.id, p.freelancer_id]);
      if (!conn) {
        conn = (await c.query(
          `INSERT INTO connections (client_id, freelancer_id, project_id, first_message, status, responded_at) VALUES ($1, $2, $3, $4, 'accepted', now()) RETURNING id, thread_id`,
          [client.id, p.freelancer_id, p.project_id, p.message],
        )).rows[0];
      } else if (!conn.thread_id) {
        await c.query(`UPDATE connections SET status = 'accepted', responded_at = now() WHERE id = $1`, [conn.id]);
      }
      let threadId = conn!.thread_id;
      if (!threadId) {
        threadId = await createThread(c, { connectionId: conn!.id, clientId: client.id, freelancerId: p.freelancer_id, firstMessage: p.message, firstSenderId: p.freelancer_id });
        // The client opened this, so the freelancer has nothing unread and the client has one message to read.
        await c.query(`UPDATE thread_participants SET unread = CASE WHEN user_id = $2 THEN 1 ELSE 0 END WHERE thread_id = $1`, [threadId, client.id]);
      }
      await c.query(`UPDATE proposals SET status = 'chosen', thread_id = $2 WHERE id = $1`, [id, threadId]);
      await notify(c, p.freelancer_id, { type: 'request_accepted', title: 'A client opened a conversation about your proposal', body: p.title, link: `/messages/${threadId}`, refId: id });
      await emit(c, [client.id, p.freelancer_id], ['proposals', 'connections', 'threads']);
      return { threadId };
    });
  });
}
