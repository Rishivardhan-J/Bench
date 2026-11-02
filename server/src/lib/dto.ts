import { compact, ms } from './guards.ts';

/** Column list that yields the frontend's Freelancer shape directly (aliases are camelCase). */
export const FREELANCER_COLS = `
  p.user_id AS id, p.name, p.headline, p.avatar_url AS "avatarUrl", p.verified, p.skills,
  p.rate_min AS "rateMin", p.rate_max AS "rateMax", p.currency,
  p.rating_avg AS "ratingAvg", p.review_count AS "reviewCount", p.avg_response_minutes AS "avgResponseMinutes",
  p.availability, p.back_on AS "backOn", p.bio, p.portfolio_url AS "portfolioUrl", p.timezone, p.languages,
  p.experience, p.education, p.portfolio, p.completeness, p.paused, p.approved,
  p.review_status AS "reviewStatus", p.review_note AS "reviewNote", ${ms('p.updated_at')} AS "updatedAt"`;

/** Public view of a profile: moderation notes are only for the owner and admins. */
export function freelancerDto(row: Record<string, unknown>, opts: { includePrivate?: boolean } = {}) {
  const dto = { ...row };
  if (!opts.includePrivate) delete dto.reviewNote;
  return compact(dto);
}
