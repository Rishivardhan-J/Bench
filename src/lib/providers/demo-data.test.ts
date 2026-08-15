import { describe, it, expect, beforeEach } from 'vitest';
import { DemoFreelancerProvider } from './freelancer-provider';
import { demoFreelancers } from './demo-data';

describe('DemoFreelancerProvider', () => {
  let provider: DemoFreelancerProvider;

  beforeEach(() => {
    provider = new DemoFreelancerProvider();
  });

  it('returns all freelancers when no filters applied', async () => {
    const results = await provider.search({});
    expect(results).toHaveLength(demoFreelancers.length);
  });

  it('filters by skill exactly', async () => {
    const results = await provider.search({ skills: ['React'] });
    expect(results.length).toBeGreaterThan(0);
    results.forEach(f => {
      const hasReact = f.skills.includes('React');
      expect(hasReact).toBe(true);
    });
  });

  it('filters by maximum rate checking rateMin', async () => {
    const maxRate = 50;
    const results = await provider.search({ rateMax: maxRate });
    expect(results.length).toBeGreaterThan(0);
    results.forEach(f => {
      expect(f.rateMin).toBeLessThanOrEqual(maxRate);
    });
  });

  it('combines multiple filters correctly', async () => {
    const results = await provider.search({ 
      skills: ['React'], 
      rateMax: 100, 
      minRating: 4.8 
    });
    
    expect(results.length).toBeGreaterThan(0);
    results.forEach(f => {
      const hasReact = f.skills.includes('React');
      expect(hasReact).toBe(true);
      expect(f.rateMin).toBeLessThanOrEqual(100);
      expect(f.rating).toBeGreaterThanOrEqual(4.8);
    });
  });
});
