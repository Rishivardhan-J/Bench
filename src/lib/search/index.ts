import type { Availability, BriefExtraction, Freelancer, MatchLine, SearchParams } from '@/types';
import { formatRate } from '@/lib/format';

const norm = (s: string) => s.trim().toLowerCase();

export function hasSkill(f: Pick<Freelancer, 'skills'>, skill: string): boolean {
  const target = norm(skill);
  return f.skills.some((s) => norm(s) === target);
}

/** Hours of 09:00–17:00 working-day overlap between two time zones (0–8). */
export function workingOverlapHours(tzA: string, tzB: string, now: Date = new Date()): number {
  const offsetHours = (tz: string): number | null => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
      return (asUtc - now.getTime()) / 3600000;
    } catch {
      return null;
    }
  };
  const a = offsetHours(tzA);
  const b = offsetHours(tzB);
  if (a === null || b === null) return 0;
  // Working hours expressed in UTC for each zone.
  const startA = 9 - a;
  const startB = 9 - b;
  const overlap = Math.min(startA + 8, startB + 8) - Math.max(startA, startB);
  return Math.max(0, Math.min(8, overlap));
}

export const MIN_OVERLAP_HOURS = 3;

export function filterFreelancers(list: Freelancer[], params: SearchParams): Freelancer[] {
  let results = list;

  if (params.query && params.query.trim()) {
    const tokens = norm(params.query).split(/\s+/).filter(Boolean);
    results = results.filter((f) => {
      const haystack = norm([f.name, f.headline, f.bio, f.skills.join(' ')].join(' '));
      return tokens.every((t) => haystack.includes(t));
    });
  }

  if (params.skills && params.skills.length > 0) {
    results = results.filter((f) => params.skills!.some((s) => hasSkill(f, s)));
  }

  if (params.rateMin !== undefined) results = results.filter((f) => f.rateMax >= params.rateMin!);
  if (params.rateMax !== undefined) results = results.filter((f) => f.rateMin <= params.rateMax!);

  if (params.availability && params.availability.length > 0) {
    results = results.filter((f) => params.availability!.includes(f.availability));
  }

  if (params.minRating !== undefined) {
    results = results.filter((f) => f.ratingAvg !== undefined && f.ratingAvg >= params.minRating!);
  }

  if (params.languages && params.languages.length > 0) {
    const wanted = params.languages.map(norm);
    results = results.filter((f) => (f.languages ?? []).some((l) => wanted.includes(norm(l))));
  }

  if (params.overlapTimezone) {
    results = results.filter(
      (f) => workingOverlapHours(params.overlapTimezone!, f.timezone) >= MIN_OVERLAP_HOURS,
    );
  }

  return results;
}

const AVAILABILITY_SCORE: Record<Availability, number> = { now: 10, this_week: 7, busy: 3, offline: 0 };

/** Higher is better. Combines skill overlap, text match, rate fit, availability, completeness and rating. */
export function scoreFreelancer(f: Freelancer, ctx: SearchParams): number {
  let score = 0;

  const wanted = ctx.skills ?? [];
  if (wanted.length > 0) {
    const hits = wanted.filter((s) => hasSkill(f, s)).length;
    score += (hits / wanted.length) * 50;
  }

  if (ctx.query && ctx.query.trim()) {
    const tokens = norm(ctx.query).split(/\s+/).filter(Boolean);
    const head = norm(f.headline);
    const bio = norm(f.bio);
    const hits = tokens.reduce((n, t) => n + (head.includes(t) ? 3 : 0) + (bio.includes(t) ? 1.5 : 0), 0);
    score += Math.min(15, hits);
  }

  if (ctx.rateMin !== undefined || ctx.rateMax !== undefined) {
    const lo = ctx.rateMin ?? 0;
    const hi = ctx.rateMax ?? Number.POSITIVE_INFINITY;
    const overlap = Math.min(hi, f.rateMax) - Math.max(lo, f.rateMin);
    if (overlap >= 0) score += 15;
    else score += Math.max(0, 15 - Math.min(15, Math.abs(overlap) / 4));
  }

  score += AVAILABILITY_SCORE[f.availability] ?? 0;

  const completeness = f.completeness ?? 0;
  score += (completeness / 100) * 3 + (completeness > 80 ? 3 : 0);

  if (f.ratingAvg !== undefined) score += (f.ratingAvg / 5) * 5;

  return score;
}

export function rankByScore(list: Freelancer[], ctx: SearchParams): Freelancer[] {
  return [...list]
    .map((f) => ({ f, s: scoreFreelancer(f, ctx) }))
    .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
    .map((x) => x.f);
}

/** One factual sentence built from the real overlap between a brief and a profile. */
export function buildMatchLine(f: Freelancer, ctx: SearchParams): MatchLine {
  const matched: string[] = [];
  const parts: string[] = [];

  const skillHits = (ctx.skills ?? []).filter((s) => hasSkill(f, s));
  if (skillHits.length > 0) {
    matched.push(...skillHits);
    parts.push(`knows ${joinList(skillHits)}`);
  }

  if (ctx.rateMin !== undefined || ctx.rateMax !== undefined) {
    const lo = ctx.rateMin ?? 0;
    const hi = ctx.rateMax ?? Number.POSITIVE_INFINITY;
    if (Math.min(hi, f.rateMax) >= Math.max(lo, f.rateMin)) {
      matched.push('rate');
      parts.push(`rate of ${formatRate(f)} fits the budget`);
    }
  }

  if (f.availability === 'now' || f.availability === 'this_week') {
    matched.push('availability');
    parts.push(f.availability === 'now' ? 'is available now' : 'is available this week');
  }

  if (parts.length === 0) {
    return { freelancerId: f.id, matchedCriteria: [], reasoning: `${f.headline} with a related background.` };
  }
  const sentence = `${f.name.split(' ')[0]} ${joinList(parts)}.`;
  return { freelancerId: f.id, matchedCriteria: matched, reasoning: sentence };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* Brief parsing: runs locally so search works without any network.    */
/* ------------------------------------------------------------------ */

const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  reactjs: 'React',
  'react.js': 'React',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  ux: 'UI/UX',
  ui: 'UI/UX',
  'ui/ux': 'UI/UX',
  'ux/ui': 'UI/UX',
  seo: 'SEO',
  sql: 'SQL',
  aws: 'AWS',
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text: string, term: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}($|[^a-z0-9])`, 'i');
  return re.test(text);
}

export function parseBrief(text: string, knownSkills: string[]): BriefExtraction {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const skill of knownSkills) {
    if (containsTerm(lower, skill)) found.add(skill);
  }
  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    const match = knownSkills.find((k) => norm(k) === norm(canonical));
    if (match && containsTerm(lower, alias)) found.add(match);
  }

  const result: BriefExtraction = { rawBrief: text, extractedSkills: [...found] };

  // Rates: "$80–120/hr", "80-120 per hour", "under $50", "up to $90", "$100/hr", "$100+"
  const range = lower.match(/\$?\s?(\d{2,4})\s?(?:-|–|—|to)\s?\$?\s?(\d{2,4})\s?(?:\/\s?h(?:ou)?r|per hour|an hour|hourly|\/h)?/);
  const upTo = lower.match(/(?:under|below|up to|max(?:imum)?|less than|at most)\s?\$?\s?(\d{2,4})/);
  const atLeast = lower.match(/\$\s?(\d{2,4})\s?\+|(?:over|above|at least|more than)\s?\$?\s?(\d{2,4})/);
  const single = lower.match(/\$\s?(\d{2,4})\s?(?:\/\s?h(?:ou)?r|per hour|an hour|hourly|\/h)/);

  if (range && Number(range[1]) < Number(range[2]) && /\$|hr|hour|budget|rate/.test(lower)) {
    result.rateMin = Number(range[1]);
    result.rateMax = Number(range[2]);
  } else if (upTo) {
    result.rateMin = 0;
    result.rateMax = Number(upTo[1]);
  } else if (atLeast) {
    result.rateMin = Number(atLeast[1] ?? atLeast[2]);
  } else if (single) {
    result.rateMin = 0;
    result.rateMax = Number(single[1]);
  }

  if (/\b(senior|sr\.?|lead|principal|staff)\b/.test(lower)) result.seniority = 'senior';
  else if (/\b(junior|jr\.?|entry[- ]level|intern)\b/.test(lower)) result.seniority = 'junior';
  else if (/\b(mid[- ]level|intermediate)\b/.test(lower)) result.seniority = 'mid';

  const timeline = lower.match(/(?:(?:start|begin|within|in|for|over|next)\s+)?(\d{1,2})\s?(day|week|month|year)s?/);
  if (timeline) result.timeline = `${timeline[1]} ${timeline[2]}${Number(timeline[1]) === 1 ? '' : 's'}`;

  return result;
}

export interface FilterChip {
  key: string;
  label: string;
}

export function describeFilters(params: SearchParams): FilterChip[] {
  const chips: FilterChip[] = [];
  if (params.query) chips.push({ key: 'q', label: `“${params.query}”` });
  (params.skills ?? []).forEach((s) => chips.push({ key: `skill:${s}`, label: s }));
  if (params.rateMin !== undefined && params.rateMax !== undefined) {
    chips.push({ key: 'rate', label: `$${params.rateMin}–${params.rateMax}/hr` });
  } else if (params.rateMin !== undefined) {
    chips.push({ key: 'rate', label: `$${params.rateMin}+/hr` });
  } else if (params.rateMax !== undefined) {
    chips.push({ key: 'rate', label: `Up to $${params.rateMax}/hr` });
  }
  (params.availability ?? []).forEach((a) => chips.push({ key: `availability:${a}`, label: a.replace('_', ' ') }));
  if (params.minRating !== undefined) chips.push({ key: 'rating', label: `${params.minRating}+ rating` });
  (params.languages ?? []).forEach((l) => chips.push({ key: `language:${l}`, label: l }));
  if (params.overlapTimezone) chips.push({ key: 'overlap', label: 'Timezone overlap' });
  return chips;
}
