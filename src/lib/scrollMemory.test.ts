import { beforeEach, describe, expect, it } from 'vitest';
import { clearScrollMemory, recallScroll, rememberScroll } from './scrollMemory';

describe('scrollMemory', () => {
  beforeEach(clearScrollMemory);

  it('returns what was stored and undefined for unknown entries', () => {
    rememberScroll('a', 120);
    expect(recallScroll('a')).toBe(120);
    expect(recallScroll('b')).toBeUndefined();
  });

  it('overwrites an entry and evicts the oldest past the limit', () => {
    rememberScroll('a', 1);
    rememberScroll('a', 2);
    expect(recallScroll('a')).toBe(2);
    for (let i = 0; i < 60; i++) rememberScroll(`k${i}`, i);
    expect(recallScroll('a')).toBeUndefined();
    expect(recallScroll('k59')).toBe(59);
  });
});
