import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { computeCompleteness } from './completeness';
import { demoFreelancers } from '@/lib/providers/demo-data';

// The server owns the real number; this asserts the client copy never drifts from it.
const server = createRequire(import.meta.url)('../../functions/src/completeness.js') as { computeCompleteness: (p: unknown) => number };

describe('completeness parity', () => {
  it('matches the Cloud Functions implementation for every seed profile', () => {
    demoFreelancers.forEach((f) => expect(computeCompleteness(f)).toBe(server.computeCompleteness(f)));
  });

  it('matches for an empty profile', () => {
    expect(computeCompleteness({})).toBe(server.computeCompleteness({}));
  });
});
