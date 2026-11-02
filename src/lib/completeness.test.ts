import { describe, expect, it } from 'vitest';
import { completenessChecks, computeCompleteness } from './completeness';
import { demoFreelancers } from '@/lib/providers/demo-data';

// The server imports this module directly, so there is one definition of "complete".
describe('completeness', () => {
  it('weights add up to 100, so a full profile scores 100', () => {
    expect(completenessChecks({}).reduce((n, c) => n + c.weight, 0)).toBe(100);
  });

  it('scores every seed profile between 0 and 100', () => {
    demoFreelancers.forEach((f) => {
      const score = computeCompleteness(f);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  it('scores an empty profile as zero', () => {
    expect(computeCompleteness({})).toBe(0);
  });
});
