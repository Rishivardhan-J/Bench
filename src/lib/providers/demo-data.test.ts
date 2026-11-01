import { describe, it, expect } from 'vitest';
import { DemoFreelancerProvider } from './freelancer-provider';
import { demoFreelancers } from './demo-data';

describe('DemoFreelancerProvider', () => {
  const provider = new DemoFreelancerProvider();

  it('returns all freelancers when no filters applied', async () => {
    expect(await provider.search({})).toHaveLength(demoFreelancers.length);
  });

  it('filters by skill, ignoring case', async () => {
    const results = await provider.search({ skills: ['react'] });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((f) => expect(f.skills.map((s) => s.toLowerCase())).toContain('react'));
  });

  it('filters by maximum rate using the lower bound of the range', async () => {
    const results = await provider.search({ rateMax: 50 });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((f) => expect(f.rateMin).toBeLessThanOrEqual(50));
  });

  it('combines multiple filters', async () => {
    const results = await provider.search({ skills: ['React'], rateMax: 100, minRating: 4.5 });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((f) => {
      expect(f.skills).toContain('React');
      expect(f.rateMin).toBeLessThanOrEqual(100);
      expect(f.ratingAvg).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('excludes unrated profiles when a minimum rating is set', async () => {
    const results = await provider.search({ minRating: 1 });
    expect(results.every((f) => f.ratingAvg !== undefined)).toBe(true);
  });

  it('keeps ids and order for getByIds, with null for unknown ids', async () => {
    const res = await provider.getByIds(['f2', 'nope', 'f1']);
    expect(res.map((f) => f?.id ?? null)).toEqual(['f2', null, 'f1']);
  });

  it('lists unique skills alphabetically', async () => {
    const skills = await provider.getAvailableSkills();
    expect(new Set(skills.map((s) => s.toLowerCase())).size).toBe(skills.length);
    expect([...skills].sort((a, b) => a.localeCompare(b))).toEqual(skills);
  });
});
