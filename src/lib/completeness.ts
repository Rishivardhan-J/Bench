import type { Freelancer } from '@/types';

// Profile completeness (F6). Keep in sync with functions/src/completeness.js; a parity test covers both.
type Profile = Partial<Freelancer>;

export interface CompletenessCheck {
  id: string;
  label: string;
  weight: number;
  done: boolean;
}

export function completenessChecks(p: Profile): CompletenessCheck[] {
  return [
    { id: 'avatar', label: 'Add a profile picture', weight: 10, done: Boolean(p.avatarUrl) },
    { id: 'name', label: 'Add your name', weight: 5, done: Boolean(p.name?.trim()) },
    { id: 'headline', label: 'Write a headline', weight: 10, done: (p.headline?.trim().length ?? 0) >= 5 },
    { id: 'bio', label: 'Write a bio of at least 80 characters', weight: 15, done: (p.bio?.trim().length ?? 0) >= 80 },
    { id: 'skills', label: 'List at least 3 skills', weight: 15, done: (p.skills?.length ?? 0) >= 3 },
    { id: 'rate', label: 'Set your hourly rate', weight: 10, done: (p.rateMin ?? 0) > 0 && (p.rateMax ?? 0) >= (p.rateMin ?? 0) },
    { id: 'timezone', label: 'Set your timezone', weight: 5, done: Boolean(p.timezone) },
    { id: 'portfolio', label: 'Add a portfolio link or item', weight: 10, done: Boolean(p.portfolioUrl) || (p.portfolio?.length ?? 0) > 0 },
    { id: 'experience', label: 'Add your experience', weight: 10, done: (p.experience?.length ?? 0) > 0 },
    { id: 'languages', label: 'Add the languages you speak', weight: 5, done: (p.languages?.length ?? 0) > 0 },
    { id: 'education', label: 'Add your education', weight: 5, done: (p.education?.length ?? 0) > 0 },
  ];
}

export function computeCompleteness(p: Profile): number {
  return completenessChecks(p).reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
}
