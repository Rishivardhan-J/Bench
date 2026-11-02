import type { Freelancer } from '@/types';
import { formatMoney } from '@/lib/format';
import { hasSkill, parseBrief } from './index';

/**
 * A plain, factual line for a freelancer reading a request: how much of the brief they cover.
 * Built from the request text and their own profile only. Returns null when there is nothing to say.
 */
export function fitNote(profile: Pick<Freelancer, 'skills' | 'rateMin' | 'rateMax'>, requestText: string, knownSkills: string[]): string | null {
  const brief = parseBrief(requestText, knownSkills);
  const parts: string[] = [];

  const wanted = brief.extractedSkills;
  if (wanted.length > 0) {
    const have = wanted.filter((s) => hasSkill(profile, s)).length;
    parts.push(`${have} of ${wanted.length} skill${wanted.length === 1 ? '' : 's'} match`);
  }

  if (brief.rateMin !== undefined || brief.rateMax !== undefined) {
    const lo = brief.rateMin ?? 0;
    const hi = brief.rateMax ?? Number.POSITIVE_INFINITY;
    if (hi < profile.rateMin) parts.push('below your rate');
    else if (lo > profile.rateMax) parts.push('above your rate');
    else parts.push('within your rate');
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

export interface MarketSummary {
  count: number;
  low: number;
  high: number;
  currency: string;
  /** "14 people match. Most charge $60–$95/hr." */
  text: string;
}

/** Below this many matches a "going rate" would be a guess about one or two people. */
export const MIN_MARKET_SAMPLE = 5;

const roundTo5 = (n: number) => Math.round(n / 5) * 5;

function percentile(sorted: number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

/** The middle half of hourly rates among a set of matches. Null when the sample is too small to mean anything. */
export function marketSummary(list: Pick<Freelancer, 'rateMin' | 'rateMax' | 'currency'>[]): MarketSummary | null {
  if (list.length < MIN_MARKET_SAMPLE) return null;

  // Rates in different currencies can't be compared, so use the most common one.
  const byCurrency = new Map<string, number>();
  list.forEach((f) => byCurrency.set(f.currency, (byCurrency.get(f.currency) ?? 0) + 1));
  const currency = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const sample = list.filter((f) => f.currency === currency && f.rateMax > 0);
  if (sample.length < MIN_MARKET_SAMPLE) return null;

  const mids = sample.map((f) => (f.rateMin + f.rateMax) / 2).sort((a, b) => a - b);
  const low = roundTo5(percentile(mids, 0.25));
  const high = roundTo5(percentile(mids, 0.75));
  const range = low === high ? `${formatMoney(low, currency)}/hr` : `${formatMoney(low, currency)}–${formatMoney(high, currency)}/hr`;
  return { count: list.length, low, high, currency, text: `${list.length} people match. Most charge ${range}.` };
}
