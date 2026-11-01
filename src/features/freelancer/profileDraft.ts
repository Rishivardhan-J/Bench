import type { EducationEntry, ExperienceEntry, Freelancer, PortfolioItem } from '@/types';
import type { ProfileDraft } from '@/lib/data/profile';

export interface Draft {
  name: string;
  headline: string;
  bio: string;
  skills: string[];
  rateMin: string;
  rateMax: string;
  currency: string;
  availability: Freelancer['availability'];
  backOn: string;
  timezone: string;
  portfolioUrl: string;
  languages: string[];
  avatarUrl: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  portfolio: PortfolioItem[];
}

export type Step = 'basics' | 'skills' | 'experience' | 'portfolio' | 'review';
export const STEPS: { id: Step; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'skills', label: 'Skills and rate' },
  { id: 'experience', label: 'Experience' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'review', label: 'Review' },
];

export const LIMITS = { skills: 30, languages: 10, experience: 10, education: 6, portfolio: 6, bio: 1000, headline: 120, name: 80 } as const;

export function draftFromProfile(p: Partial<Freelancer>): Draft {
  return {
    name: p.name ?? '',
    headline: p.headline ?? '',
    bio: p.bio ?? '',
    skills: p.skills ?? [],
    rateMin: p.rateMin ? String(p.rateMin) : '',
    rateMax: p.rateMax ? String(p.rateMax) : '',
    currency: p.currency ?? 'USD',
    availability: p.availability ?? 'now',
    backOn: p.backOn ?? '',
    timezone: p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    portfolioUrl: p.portfolioUrl ?? '',
    languages: p.languages ?? [],
    avatarUrl: p.avatarUrl ?? '',
    experience: p.experience ?? [],
    education: p.education ?? [],
    portfolio: p.portfolio ?? [],
  };
}

const clean = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o));

export function toPayload(d: Draft): ProfileDraft {
  return {
    name: d.name.trim(),
    headline: d.headline.trim(),
    bio: d.bio.trim(),
    skills: d.skills,
    rateMin: Number(d.rateMin) || 0,
    rateMax: Number(d.rateMax) || 0,
    currency: d.currency,
    availability: d.availability,
    backOn: d.availability === 'offline' ? d.backOn || null : null,
    timezone: d.timezone,
    portfolioUrl: d.portfolioUrl.trim() || undefined,
    languages: d.languages,
    avatarUrl: d.avatarUrl || undefined,
    experience: clean(d.experience.filter((e) => e.title.trim() && e.company.trim())),
    education: clean(d.education.filter((e) => e.school.trim() && e.degree.trim())),
    portfolio: clean(d.portfolio.filter((p) => p.title.trim() && p.link.trim())),
  };
}

const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export type Errors = Partial<Record<string, string>>;

/** Rules that must hold before a profile is submitted for review. */
export function validateForSubmit(d: Draft): Errors {
  const e: Errors = {};
  if (!d.name.trim()) e.name = 'Enter your full name.';
  if (d.headline.trim().length < 5) e.headline = 'Write a headline of at least 5 characters, like "Senior React developer".';
  if (d.bio.trim().length < 40) e.bio = 'Write at least 40 characters about your background.';
  if (d.skills.length === 0) e.skills = 'Add at least one skill.';
  const lo = Number(d.rateMin);
  const hi = Number(d.rateMax);
  if (!lo || lo <= 0) e.rateMin = 'Enter your minimum hourly rate.';
  if (!hi || hi <= 0) e.rateMax = 'Enter your maximum hourly rate.';
  else if (lo && hi < lo) e.rateMax = 'Maximum must be at least the minimum.';
  if (d.portfolioUrl && !isUrl(d.portfolioUrl)) e.portfolioUrl = 'Use a full link starting with https://';
  d.portfolio.forEach((p, i) => {
    if (p.link && !isUrl(p.link)) e[`portfolio.${i}.link`] = 'Use a full link starting with https://';
  });
  return e;
}

/** Whether the data could be saved as a draft (the security rules' hard constraints). */
export function isSavableDraft(d: Draft): boolean {
  const lo = Number(d.rateMin) || 0;
  const hi = Number(d.rateMax) || 0;
  return hi >= lo && d.bio.length <= LIMITS.bio && d.headline.length <= LIMITS.headline;
}

export function stepForError(key: string): Step {
  if (['name', 'headline', 'bio'].includes(key)) return 'basics';
  if (['skills', 'rateMin', 'rateMax'].includes(key)) return 'skills';
  if (key.startsWith('experience') || key.startsWith('education')) return 'experience';
  return 'portfolio';
}
