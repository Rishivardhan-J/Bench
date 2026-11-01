import { describe, expect, it } from 'vitest';
import { buildMatchLine, filterFreelancers, parseBrief, rankByScore, workingOverlapHours } from './index';
import { demoFreelancers } from '@/lib/providers/demo-data';

const skills = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'UI/UX', 'SEO'];

describe('parseBrief', () => {
  it('extracts skills, aliases, rate range and seniority', () => {
    const r = parseBrief('Need a senior reactjs and ts developer, $80-120/hr, start in 2 weeks', skills);
    expect(r.extractedSkills).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(r.rateMin).toBe(80);
    expect(r.rateMax).toBe(120);
    expect(r.seniority).toBe('senior');
    expect(r.timeline).toBe('2 weeks');
  });

  it('reads "under $50" as an upper bound', () => {
    const r = parseBrief('SEO help under $50 an hour', skills);
    expect(r.rateMax).toBe(50);
    expect(r.rateMin).toBe(0);
  });

  it('does not match a skill inside another word', () => {
    expect(parseBrief('We love reactive programming', skills).extractedSkills).not.toContain('React');
  });
});

describe('filterFreelancers and ranking', () => {
  it('keeps only people with a requested skill', () => {
    const out = filterFreelancers(demoFreelancers, { skills: ['React'] });
    expect(out.length).toBeGreaterThan(0);
    out.forEach((f) => expect(f.skills).toContain('React'));
  });

  it('ranks full skill matches above partial ones', () => {
    const ranked = rankByScore(filterFreelancers(demoFreelancers, { skills: ['React', 'TypeScript'] }), { skills: ['React', 'TypeScript'] });
    const hits = (f: (typeof ranked)[number]) => ['React', 'TypeScript'].filter((s) => f.skills.includes(s)).length;
    for (let i = 1; i < ranked.length; i++) expect(hits(ranked[i - 1])).toBeGreaterThanOrEqual(hits(ranked[i]) - 1);
    expect(hits(ranked[0])).toBe(Math.max(...ranked.map(hits)));
  });

  it('builds a factual match line from real overlap', () => {
    const f = demoFreelancers.find((x) => x.skills.includes('React'))!;
    expect(buildMatchLine(f, { skills: ['React'] }).reasoning).toContain('React');
  });
});

describe('workingOverlapHours', () => {
  it('is full for the same zone and zero for opposite sides of the world', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(workingOverlapHours('Europe/London', 'Europe/London', now)).toBe(8);
    expect(workingOverlapHours('America/Los_Angeles', 'Asia/Tokyo', now)).toBe(0);
  });
});
