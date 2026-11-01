import { describe, expect, it } from 'vitest';
import { pageForPath, pageKey } from './routes';
import { accountMenuFor, navFor } from './navigation';

describe('pageForPath', () => {
  it('resolves every navigation and account menu target to a page', () => {
    for (const role of ['client', 'freelancer', 'admin'] as const) {
      for (const item of [...navFor(role), ...accountMenuFor(role)]) {
        expect(pageForPath(item.to), `${role}: ${item.to}`).not.toBeNull();
      }
    }
  });

  it('distinguishes freelancer tools from public profiles', () => {
    expect(pageForPath('/freelancer/status')).toBe('StatusPage');
    expect(pageForPath('/freelancer/f1')).toBe('FreelancerDetail');
    expect(pageForPath('/messages/t1')).toBe('MessagesPage');
    expect(pageForPath('/projects/p1')).toBe('ProjectDetailPage');
    expect(pageForPath('/nope')).toBeNull();
  });

  it('ignores query strings and hashes', () => {
    expect(pageForPath('/settings#saved-searches')).toBe('SettingsPage');
    expect(pageForPath('/?q=react')).toBe('SearchPage');
  });
});

describe('pageKey', () => {
  it('keeps the inbox mounted when switching threads', () => {
    expect(pageKey('/messages/a')).toBe(pageKey('/messages/b'));
    expect(pageKey('/messages')).toBe(pageKey('/messages/a'));
  });

  it('differs between genuinely different pages', () => {
    expect(pageKey('/shortlists')).not.toBe(pageKey('/projects'));
  });
});
