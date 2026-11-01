import { describe, expect, it } from 'vitest';
import { computeCompleteness } from './completeness';
import { demoFreelancers } from '@/lib/providers/demo-data';

// The server owns the real number; this asserts the client copy never drifts from it.
// @ts-expect-error CommonJS module without type declarations
const serverModule = await import('../../functions/src/completeness.js');
const server = (serverModule.default ?? serverModule) as { computeCompleteness: (p: unknown) => number };

describe('completeness parity', () => {
  it('matches the Cloud Functions implementation for every seed profile', () => {
    demoFreelancers.forEach((f) => expect(computeCompleteness(f)).toBe(server.computeCompleteness(f)));
  });

  it('matches for an empty profile', () => {
    expect(computeCompleteness({})).toBe(server.computeCompleteness({}));
  });
});
