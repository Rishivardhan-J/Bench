import { beforeEach, describe, expect, it } from 'vitest';
import { readCachedRole, writeCachedRole } from './roleCache';

describe('roleCache', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips a role and clears it', () => {
    writeCachedRole('freelancer');
    expect(readCachedRole()).toBe('freelancer');
    writeCachedRole(null);
    expect(readCachedRole()).toBeNull();
  });

  it('ignores unknown stored values', () => {
    window.localStorage.setItem('bench.role', 'superuser');
    expect(readCachedRole()).toBeNull();
  });
});
