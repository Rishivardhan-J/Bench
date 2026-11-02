import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { computeCompleteness } from '@/lib/completeness';
import { many, one, pool, tx, type Db } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { FREELANCER_COLS, freelancerDto } from '../lib/dto.ts';
import { emit } from '../lib/events.ts';
import { adminIds, compact, ms } from '../lib/guards.ts';
import { HOUR, enforceRateLimit } from '../lib/rateLimit.ts';
import { clientIp, requireAuth, requireRole } from '../lib/session.ts';
import { id as idSchema, parse } from '../lib/validate.ts';

const short = (max: number) => z.string().max(max);
const ownFile = (uid: string, kind: 'avatars' | 'portfolio') => (v: string) => v.startsWith(`/api/files/public/${kind}/${uid}/`) && !v.includes('..');

const experience = z.object({ title: short(100), company: short(100), startYear: z.number().int().min(1950).max(2100), endYear: z.number().int().min(1950).max(2100).nullish(), description: short(240).nullish() });
const education = z.object({ school: short(100), degree: short(100), startYear: z.number().int().nullish(), endYear: z.number().int().nullish() });
const portfolioItem = z.object({ title: short(80), link: short(300).nullish(), description: short(200).nullish(), imageUrl: short(400).nullish() });

const draftSchema = (uid: string) =>
  z
    .object({
      name: z.string().trim().min(1, 'Add your name.').max(80),
      headline: short(120),
      bio: short(1000),
      skills: z.array(z.string().trim().min(1).max(50)).max(30),
      rateMin: z.number().min(0).max(100000),
      rateMax: z.number().min(0).max(100000),
      currency: z.string().length(3).default('USD'),
      timezone: z.string().min(1).max(64),
      portfolioUrl: short(300).nullish(),
      avatarUrl: z.string().max(400).refine(ownFile(uid, 'avatars'), 'Use an image you uploaded.').nullish(),
      languages: z.array(short(40)).max(20),
      experience: z.array(experience).max(10),
      education: z.array(education).max(6),
      portfolio: z.array(portfolioItem).max(6),
      availability: z.enum(['now', 'this_week', 'busy', 'offline']),
      backOn: short(20).nullish(),
      paused: z.boolean().optional(),
    })
    .refine((d) => d.rateMax >= d.rateMin, { message: 'The top of your rate range must be at least the bottom.', path: ['rateMax'] })
    .refine((d) => d.portfolioUrl == null || d.portfolioUrl === '' || /^https?:\/\//i.test(d.portfolioUrl), { message: 'Portfolio link must start with http:// or https://.', path: ['portfolioUrl'] })
    .refine((d) => d.portfolio.every((p) => !p.imageUrl || ownFile(uid, 'portfolio')(p.imageUrl) || /^https:\/\//i.test(p.imageUrl)), { message: 'Portfolio images must be uploaded or https links.', path: ['portfolio'] });

const CORE = ['name', 'headline', 'bio', 'skills', 'rateMin', 'rateMax', 'currency', 'timezone', 'portfolioUrl', 'avatarUrl', 'languages', 'experience', 'education', 'portfolio'] as const;

type Draft = z.infer<ReturnType<typeof draftSchema>>;

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Everyone may see a live profile; the owner and admins may see their own at any stage. */
export function canSeeProfile(req: FastifyRequest, row: { id: string; approved: boolean; paused: boolean }): boolean {
  return (row.approved && !row.paused) || req.user?.id === row.id || req.user?.isAdmin === true;
}

export async function getProfile(db: Db, uid: string) {
  return one<Record<string, unknown>>(db, `SELECT ${FREELANCER_COLS} FROM freelancer_profiles p WHERE p.user_id = $1`, [uid]);
}

/**
 * The server decides moderation. Editing a core field of a live profile takes it offline and
 * back to review; availability and pausing never do. The client cannot set approved, verified or ratings.
 */
export async function saveProfile(uid: string, draft: Draft, submit: boolean) {
  return tx(async (c) => {
    const current = await one<Record<string, unknown>>(c, `SELECT ${FREELANCER_COLS} FROM freelancer_profiles p WHERE p.user_id = $1 FOR UPDATE`, [uid]);
    if (!current) throw new ApiError('not-found', 'Profile not found.');
    const wasLive = current.approved === true;
    const changedCore = CORE.some((k) => !sameValue(current[k], draft[k]));
    const staysLive = wasLive && !changedCore && !submit;

    if (staysLive) {
      await c.query(
        `UPDATE freelancer_profiles SET availability = $2, back_on = $3, paused = $4, updated_at = now() WHERE user_id = $1`,
        [uid, draft.availability, draft.backOn || null, draft.paused ?? current.paused],
      );
      await emit(c, [uid], ['profile']);
      return { status: 'approved' as const, wentOffline: false };
    }

    const status = submit || wasLive || current.reviewStatus === 'pending' ? 'pending' : 'draft';
    const completeness = computeCompleteness({ ...draft, avatarUrl: draft.avatarUrl ?? undefined, portfolioUrl: draft.portfolioUrl ?? undefined } as never);
    await c.query(
      `UPDATE freelancer_profiles SET name = $2, headline = $3, bio = $4, skills = $5, rate_min = $6, rate_max = $7, currency = $8,
         timezone = $9, portfolio_url = $10, avatar_url = $11, languages = $12, experience = $13, education = $14, portfolio = $15,
         availability = $16, back_on = $17, paused = $18, approved = false, review_status = $19, completeness = $20, updated_at = now()
       WHERE user_id = $1`,
      [
        uid, draft.name, draft.headline, draft.bio, draft.skills, draft.rateMin, draft.rateMax, draft.currency, draft.timezone,
        draft.portfolioUrl || null, draft.avatarUrl || null, draft.languages, JSON.stringify(draft.experience), JSON.stringify(draft.education),
        JSON.stringify(draft.portfolio), draft.availability, draft.backOn || null, draft.paused ?? current.paused, status, completeness,
      ],
    );
    await emit(c, [uid, ...(await adminIds(c))], ['profile', 'admin']);
    return { status: status as 'draft' | 'pending', wentOffline: wasLive };
  });
}

export async function freelancerRoutes(app: FastifyInstance) {
  // The searchable catalogue: only approved, unpaused profiles. The browser ranks it.
  app.get('/api/freelancers', async () => {
    const rows = await many(pool, `SELECT ${FREELANCER_COLS} FROM freelancer_profiles p WHERE p.approved AND NOT p.paused ORDER BY p.name`);
    return { freelancers: rows.map((r) => freelancerDto(r)) };
  });

  app.post('/api/freelancers/by-ids', async (req) => {
    const { ids } = parse(z.object({ ids: z.array(idSchema()).max(100) }), req.body);
    if (ids.length === 0) return { freelancers: [] };
    const rows = await many<Record<string, unknown>>(pool, `SELECT ${FREELANCER_COLS} FROM freelancer_profiles p WHERE p.user_id = ANY($1) AND p.approved AND NOT p.paused`, [ids]);
    const byId = new Map(rows.map((r) => [r.id as string, freelancerDto(r)]));
    return { freelancers: ids.map((i) => byId.get(i) ?? null) };
  });

  app.get('/api/freelancers/:id', async (req) => {
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const row = await getProfile(pool, id);
    if (!row || !canSeeProfile(req, row as never)) throw new ApiError('not-found', 'Profile not found.');
    return { freelancer: freelancerDto(row, { includePrivate: req.user?.id === id || req.user?.isAdmin === true }) };
  });

  app.get('/api/me/freelancer', async (req) => {
    const user = requireRole(req, 'freelancer');
    const row = await getProfile(pool, user.id);
    if (!row) throw new ApiError('not-found', 'Profile not found.');
    return { freelancer: freelancerDto(row, { includePrivate: true }) };
  });

  app.put('/api/me/freelancer', async (req) => {
    const user = requireRole(req, 'freelancer');
    const body = parse(z.object({ draft: draftSchema(user.id), submit: z.boolean().default(false) }), req.body);
    return saveProfile(user.id, body.draft, body.submit);
  });

  app.put('/api/me/freelancer/paused', async (req) => {
    const user = requireRole(req, 'freelancer');
    const { paused } = parse(z.object({ paused: z.boolean() }), req.body);
    await tx(async (c) => {
      await c.query('UPDATE freelancer_profiles SET paused = $2, updated_at = now() WHERE user_id = $1', [user.id, paused]);
      await emit(c, [user.id], ['profile']);
    });
    return { paused };
  });

  app.get('/api/freelancers/:id/reviews', async (req) => {
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const rows = await many(
      pool,
      `SELECT id, hire_id AS "hireId", client_id AS "clientUid", freelancer_id AS "freelancerUid", client_name AS "clientName", rating, text, reply,
              ${ms('created_at')} AS "createdAt"
       FROM reviews WHERE freelancer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [id],
    );
    return { reviews: rows.map((r) => compact(r)) };
  });

  // Earned numbers only: computed from real rows and hidden until there is enough history.
  app.get('/api/freelancers/:id/track-record', async (req) => {
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const profile = await getProfile(pool, id);
    if (!profile || !canSeeProfile(req, profile as never)) throw new ApiError('not-found', 'Profile not found.');
    const c = await one<{ requests: number; answered: number; expired: number }>(
      pool,
      `SELECT count(*) AS requests,
              count(*) FILTER (WHERE status IN ('accepted', 'declined', 'blocked')) AS answered,
              count(*) FILTER (WHERE status = 'expired') AS expired
       FROM connections WHERE freelancer_id = $1`,
      [id],
    );
    const h = await one<{ hires: number; repeat: number }>(
      pool,
      `SELECT count(*) AS hires,
              (SELECT count(*) FROM (SELECT 1 FROM hires WHERE freelancer_id = $1 GROUP BY client_id HAVING count(*) > 1) r) AS repeat
       FROM hires WHERE freelancer_id = $1`,
      [id],
    );
    const requests = c?.requests ?? 0;
    return {
      visible: requests >= 3,
      requests,
      answered: c?.answered ?? 0,
      expired: c?.expired ?? 0,
      hires: h?.hires ?? 0,
      repeatClients: h?.repeat ?? 0,
      typicalReplyMinutes: (profile.avgResponseMinutes as number | undefined) ?? null,
    };
  });

  app.post('/api/freelancers/:id/view', async (req) => {
    const { id } = parse(z.object({ id: idSchema() }), req.params);
    const viewer = req.user?.id ?? clientIp(req);
    if (viewer === id) return { counted: false };
    await enforceRateLimit(pool, 'view', viewer, 120, HOUR, 'Too many views.');
    const hash = crypto.createHash('sha256').update(String(viewer)).digest('hex').slice(0, 24);
    const counted = await tx(async (c) => {
      const live = await one(c, 'SELECT 1 FROM freelancer_profiles WHERE user_id = $1 AND approved AND NOT paused', [id]);
      if (!live) return false;
      const seen = await c.query(`INSERT INTO profile_viewers (freelancer_id, day, viewer_hash) VALUES ($1, current_date, $2) ON CONFLICT DO NOTHING`, [id, hash]);
      if (seen.rowCount === 0) return false;
      await c.query(
        `INSERT INTO profile_stats_daily (freelancer_id, day, views) VALUES ($1, current_date, 1)
         ON CONFLICT (freelancer_id, day) DO UPDATE SET views = profile_stats_daily.views + 1`,
        [id],
      );
      return true;
    });
    return { counted };
  });

  app.get('/api/me/stats', async (req) => {
    const user = requireAuth(req);
    const rows = await many(
      pool,
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, views, shortlist_adds AS "shortlistAdds", requests
       FROM profile_stats_daily WHERE freelancer_id = $1 ORDER BY day DESC LIMIT 28`,
      [user.id],
    );
    return { stats: rows };
  });
}
