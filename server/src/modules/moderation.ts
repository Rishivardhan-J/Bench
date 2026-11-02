import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { filterFreelancers } from '@/lib/search';
import type { Freelancer, SearchParams } from '@/types';
import { many, one, pool, tx, type Db } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { FREELANCER_COLS, freelancerDto } from '../lib/dto.ts';
import { emit } from '../lib/events.ts';
import { adminIds, compact, isBlockedEitherWay, ms } from '../lib/guards.ts';
import { notify } from '../lib/notify.ts';
import { DAY, enforceRateLimit } from '../lib/rateLimit.ts';
import { requireAdmin, requireAuth } from '../lib/session.ts';
import { id as idSchema, optText, parse, text } from '../lib/validate.ts';

/** Saved searches with alerts on: tell each client whose search a newly live profile matches. */
async function sendSearchAlerts(c: Db, freelancer: Record<string, unknown>) {
  const searches = await many<{ client_id: string; label: string; query: string; filters: SearchParams }>(
    c, 'SELECT client_id, label, query, filters FROM saved_searches WHERE alert_enabled', [],
  );
  const profile = freelancerDto(freelancer) as unknown as Freelancer;
  for (const s of searches) {
    const params: SearchParams = { ...s.filters, ...(s.query ? { query: s.query } : {}) };
    // A search with no criteria would match everyone; skip it.
    const hasCriteria = (params.skills?.length ?? 0) > 0 || Boolean(params.query?.trim()) || params.rateMin !== undefined || params.rateMax !== undefined;
    if (!hasCriteria || filterFreelancers([profile], params).length === 0) continue;
    if (await isBlockedEitherWay(c, s.client_id, profile.id)) continue;
    await notify(c, s.client_id, { type: 'search_alert', title: `New match for "${s.label}"`, body: `${profile.name} just went live.`, link: `/freelancer/${profile.id}`, refId: profile.id });
  }
}

export async function moderationRoutes(app: FastifyInstance) {
  app.post('/api/reports', async (req) => {
    const user = requireAuth(req);
    const body = parse(
      z.object({
        targetType: z.enum(['profile', 'message']),
        targetId: idSchema('targetId'),
        reason: text(500, 'Reason').refine((r) => r.length >= 3, 'Please tell us a little more.'),
      }),
      req.body,
    );
    await enforceRateLimit(pool, 'report', user.id, 20, DAY, 'You have sent many reports today. Try again tomorrow.');
    await tx(async (c) => {
      await c.query('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)', [user.id, body.targetType, body.targetId, body.reason]);
      await emit(c, await adminIds(c), ['admin']);
    });
    return { ok: true };
  });

  app.get('/api/admin/pending', async (req) => {
    requireAdmin(req);
    const rows = await many(pool, `SELECT ${FREELANCER_COLS} FROM freelancer_profiles p WHERE p.review_status = 'pending' ORDER BY p.updated_at ASC LIMIT 100`);
    return { freelancers: rows.map((r) => freelancerDto(r, { includePrivate: true })) };
  });

  app.get('/api/admin/reports', async (req) => {
    requireAdmin(req);
    const rows = await many(
      pool,
      `SELECT id, reporter_id AS "reporterUid", target_type AS "targetType", target_id AS "targetId", reason, status, ${ms('created_at')} AS "createdAt"
       FROM reports WHERE status = 'open' ORDER BY created_at DESC LIMIT 100`,
    );
    return { reports: rows.map((r) => compact(r)) };
  });

  app.post('/api/admin/review', async (req) => {
    requireAdmin(req);
    const body = parse(
      z.object({ uid: idSchema('uid'), decision: z.enum(['approve', 'request_changes'], { error: 'Unknown decision.' }), note: optText(500, 'A reason') }),
      req.body,
    );
    if (body.decision === 'request_changes' && !body.note) throw new ApiError('invalid-argument', 'A reason is required.');
    await tx(async (c) => {
      const before = await one<{ approved: boolean }>(c, 'SELECT approved FROM freelancer_profiles WHERE user_id = $1 FOR UPDATE', [body.uid]);
      if (!before) throw new ApiError('not-found', 'Profile not found.');

      if (body.decision === 'approve') {
        await c.query(`UPDATE freelancer_profiles SET approved = true, review_status = 'approved', review_note = NULL, updated_at = now() WHERE user_id = $1`, [body.uid]);
        if (!before.approved) {
          await notify(c, body.uid, { type: 'profile_status', title: 'Your profile is live', body: 'Clients can now find you in search.', link: '/freelancer/status' });
          const live = await one<Record<string, unknown>>(c, `SELECT ${FREELANCER_COLS} FROM freelancer_profiles p WHERE p.user_id = $1`, [body.uid]);
          if (live && live.paused !== true) await sendSearchAlerts(c, live);
        }
      } else {
        await c.query(`UPDATE freelancer_profiles SET approved = false, review_status = 'changes_requested', review_note = $2, updated_at = now() WHERE user_id = $1`, [body.uid, body.note]);
        await notify(c, body.uid, { type: 'profile_status', title: 'Changes requested on your profile', body: body.note!, link: '/freelancer/status' });
      }
      await emit(c, [body.uid, ...(await adminIds(c))], ['profile', 'admin']);
      await emit(c, '*', ['catalogue']);
    });
    return { ok: true };
  });

  app.post('/api/admin/verify', async (req) => {
    requireAdmin(req);
    const body = parse(z.object({ uid: idSchema('uid'), verified: z.boolean() }), req.body);
    const res = await pool.query('UPDATE freelancer_profiles SET verified = $2 WHERE user_id = $1', [body.uid, body.verified]);
    if (res.rowCount === 0) throw new ApiError('not-found', 'Profile not found.');
    return { ok: true };
  });

  app.post('/api/admin/reports/:id/resolve', async (req) => {
    requireAdmin(req);
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const { suspend } = parse(z.object({ suspend: z.boolean().optional() }), req.body);
    await tx(async (c) => {
      const report = await one<{ target_type: string; target_id: string }>(c, 'SELECT target_type, target_id FROM reports WHERE id = $1 FOR UPDATE', [id]);
      if (!report) throw new ApiError('not-found', 'Report not found.');
      if (suspend === true && report.target_type === 'profile') {
        await c.query(
          `UPDATE freelancer_profiles SET approved = false, review_status = 'changes_requested',
             review_note = 'This profile was removed from search after a report. Contact support to discuss.', updated_at = now() WHERE user_id = $1`,
          [report.target_id],
        );
        await emit(c, [report.target_id], ['profile']);
        await emit(c, '*', ['catalogue']);
      }
      await c.query(`UPDATE reports SET status = 'resolved', resolved_at = now() WHERE id = $1`, [id]);
      await emit(c, await adminIds(c), ['admin']);
    });
    return { ok: true };
  });

  app.post('/api/admin/lookup', async (req) => {
    requireAdmin(req);
    const { email } = parse(z.object({ email: z.string().trim().toLowerCase().max(200) }), req.body);
    const row = await one<Record<string, unknown>>(
      pool,
      `SELECT u.id AS uid, u.email, u.role, to_char(u.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt",
              fp.name AS fname, fp.approved AS fapproved, fp.review_status AS fstatus
       FROM users u LEFT JOIN freelancer_profiles fp ON fp.user_id = u.id WHERE u.email = $1`,
      [email],
    );
    if (!row) throw new ApiError('not-found', 'No account with that email.');
    return {
      uid: row.uid, email: row.email, role: row.role, disabled: false, createdAt: row.createdAt,
      profile: row.fname === null ? null : { name: row.fname, approved: row.fapproved, reviewStatus: row.fstatus },
    };
  });
}
