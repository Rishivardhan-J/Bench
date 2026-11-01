import { describe, expect, it } from 'vitest';
import { detectOffPlatform } from './offPlatform';

describe('detectOffPlatform', () => {
  it('flags phone numbers and messenger handles', () => {
    expect(detectOffPlatform('call +1 415 555 0132')).toBe('phone');
    expect(detectOffPlatform('add me on whatsapp')).toBe('messenger');
  });

  it('leaves ordinary project talk alone', () => {
    expect(detectOffPlatform('Can you start next Monday and finish in 6 weeks?')).toBeNull();
  });
});
