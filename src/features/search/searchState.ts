import type { Availability, Freelancer, SearchParams } from '@/types';
import { rankByScore } from '@/lib/search';

export type SortField = 'relevance' | 'rate' | 'rating' | 'response_time';
export type SortDir = 'asc' | 'desc';

export interface ManualFilters {
  keyword: string;
  skills: string[];
  rateMin: number | null;
  rateMax: number | null;
  availability: Availability[];
  minRating: number | null;
  languages: string[];
  overlap: boolean;
}

export interface SearchState {
  brief: string;
  filters: ManualFilters;
  sort: SortField;
  dir: SortDir;
}

export const EMPTY_FILTERS: ManualFilters = {
  keyword: '',
  skills: [],
  rateMin: null,
  rateMax: null,
  availability: [],
  minRating: null,
  languages: [],
  overlap: false,
};

export const DEFAULT_DIR: Record<SortField, SortDir> = { relevance: 'desc', rate: 'asc', rating: 'desc', response_time: 'asc' };

const AVAILABILITY: Availability[] = ['now', 'this_week', 'busy', 'offline'];
const SORTS: SortField[] = ['relevance', 'rate', 'rating', 'response_time'];

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const num = (v: string | null) => {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function readSearchState(p: URLSearchParams): SearchState {
  const sort = SORTS.includes(p.get('sort') as SortField) ? (p.get('sort') as SortField) : 'relevance';
  const dirParam = p.get('dir');
  return {
    brief: (p.get('b') ?? '').slice(0, 2000),
    filters: {
      keyword: p.get('q') ?? '',
      skills: list(p.get('skills')),
      rateMin: num(p.get('min')),
      rateMax: num(p.get('max')),
      availability: list(p.get('avail')).filter((a): a is Availability => AVAILABILITY.includes(a as Availability)),
      minRating: num(p.get('rating')),
      languages: list(p.get('lang')),
      overlap: p.get('overlap') === '1',
    },
    sort,
    dir: dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort],
  };
}

export function writeSearchState(s: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.brief) p.set('b', s.brief);
  const f = s.filters;
  if (f.keyword) p.set('q', f.keyword);
  if (f.skills.length) p.set('skills', f.skills.join(','));
  if (f.rateMin !== null) p.set('min', String(f.rateMin));
  if (f.rateMax !== null) p.set('max', String(f.rateMax));
  if (f.availability.length) p.set('avail', f.availability.join(','));
  if (f.minRating !== null) p.set('rating', String(f.minRating));
  if (f.languages.length) p.set('lang', f.languages.join(','));
  if (f.overlap) p.set('overlap', '1');
  if (s.sort !== 'relevance') p.set('sort', s.sort);
  if (s.dir !== DEFAULT_DIR[s.sort]) p.set('dir', s.dir);
  return p;
}

export interface Derived {
  skills: string[];
  rateMin?: number;
  rateMax?: number;
}

/** Manual rail filters win; brief-derived values fill in anything left unset and not dismissed. */
export function effectiveParams(manual: ManualFilters, derived: Derived, dismissed: Set<string>, timezone: string): SearchParams {
  const derivedSkills = derived.skills.filter((s) => !dismissed.has(`skill:${s}`));
  const skills = [...new Set([...manual.skills, ...derivedSkills])];
  const rateDismissed = dismissed.has('rate');
  const useDerivedRate = manual.rateMin === null && manual.rateMax === null && !rateDismissed;
  return {
    query: manual.keyword.trim() || undefined,
    skills: skills.length ? skills : undefined,
    rateMin: manual.rateMin ?? (useDerivedRate ? derived.rateMin : undefined) ?? undefined,
    rateMax: manual.rateMax ?? (useDerivedRate ? derived.rateMax : undefined) ?? undefined,
    availability: manual.availability.length ? manual.availability : undefined,
    minRating: manual.minRating ?? undefined,
    languages: manual.languages.length ? manual.languages : undefined,
    overlapTimezone: manual.overlap ? timezone : undefined,
  };
}

const STOPWORDS = new Set(
  'a an and are as at be but by for from has have i in is it its of on or our that the their this to we with you your need needs looking want who will would must should can could start within about into over under per hour hours month months week weeks day days budget rate freelancer developer contract project help'.split(' '),
);

/** Meaningful words from a brief, used only to rank results. */
export function rankingText(brief: string): string | undefined {
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d/.test(w));
  return words.length ? [...new Set(words)].slice(0, 12).join(' ') : undefined;
}

const avgRate = (f: Freelancer) => (f.rateMin + f.rateMax) / 2;

function byOptional(get: (f: Freelancer) => number | undefined, dir: SortDir) {
  return (a: Freelancer, b: Freelancer) => {
    const x = get(a);
    const y = get(b);
    // Missing values always sort last, whichever direction is chosen.
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return dir === 'asc' ? x - y : y - x;
  };
}

export function sortResults(list: Freelancer[], field: SortField, dir: SortDir, ctx: SearchParams): Freelancer[] {
  if (field === 'relevance') {
    const ranked = rankByScore(list, ctx);
    return dir === 'desc' ? ranked : ranked.reverse();
  }
  const copy = [...list];
  if (field === 'rate') copy.sort((a, b) => (dir === 'asc' ? avgRate(a) - avgRate(b) : avgRate(b) - avgRate(a)));
  else if (field === 'rating') copy.sort(byOptional((f) => f.ratingAvg, dir));
  else copy.sort(byOptional((f) => f.avgResponseMinutes, dir));
  return copy;
}
