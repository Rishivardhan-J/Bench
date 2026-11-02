import { describe, expect, it } from 'vitest';
import { fitNote, marketSummary } from './insights';

const SKILLS = ['React', 'TypeScript', 'Firebase', 'Figma'];
const me = { skills: ['React', 'TypeScript'], rateMin: 80, rateMax: 120 };

describe('fitNote', () => {
  it('counts the requested skills a freelancer covers', () => {
    expect(fitNote(me, 'Need React, TypeScript and Firebase work', SKILLS)).toBe('2 of 3 skills match');
  });

  it('compares the stated budget with their rate', () => {
    expect(fitNote(me, 'React developer, $90-110/hr', SKILLS)).toBe('1 of 1 skill match, within your rate');
    expect(fitNote(me, 'React developer, $30-50/hr', SKILLS)).toBe('1 of 1 skill match, below your rate');
    expect(fitNote(me, 'React developer, $150-200/hr', SKILLS)).toBe('1 of 1 skill match, above your rate');
  });

  it('says nothing when the request has no skills or budget', () => {
    expect(fitNote(me, 'Hello, could we talk this week?', SKILLS)).toBeNull();
  });
});

describe('marketSummary', () => {
  const people = (rates: [number, number][], currency = 'USD') => rates.map(([rateMin, rateMax]) => ({ rateMin, rateMax, currency }));

  it('stays quiet below five matches', () => {
    expect(marketSummary(people([[50, 60], [60, 70], [70, 80], [80, 90]]))).toBeNull();
  });

  it('reports the middle half of hourly rates', () => {
    const summary = marketSummary(people([[40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 100], [100, 110]]));
    expect(summary).toMatchObject({ count: 7, low: 60, high: 90, currency: 'USD' });
    expect(summary?.text).toBe('7 people match. Most charge $60–$90/hr.');
  });

  it('collapses a single value and ignores other currencies', () => {
    const same = marketSummary(people([[80, 80], [80, 80], [80, 80], [80, 80], [80, 80]]));
    expect(same?.text).toBe('5 people match. Most charge $80/hr.');
    expect(marketSummary([...people([[50, 60], [50, 60], [50, 60], [50, 60]]), ...people([[900, 1000]], 'INR')])).toBeNull();
  });
});
