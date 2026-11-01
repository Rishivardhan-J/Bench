import { describe, expect, it } from 'vitest';
import { activePath, navFor } from './navigation';

describe('activePath', () => {
  it('matches the root only exactly', () => {
    const items = navFor('client');
    expect(activePath(items, '/')).toBe('/');
    expect(activePath(items, '/shortlists')).toBe('/shortlists');
  });

  it('keeps the parent active on nested pages', () => {
    const items = navFor('client');
    expect(activePath(items, '/messages/abc')).toBe('/messages');
    expect(activePath(items, '/projects/new')).toBe('/projects');
  });

  it('picks only the most specific item', () => {
    expect(activePath(navFor('admin'), '/admin/reports')).toBe('/admin/reports');
    expect(activePath(navFor('admin'), '/admin')).toBe('/admin');
  });

  it('returns nothing for pages outside the nav', () => {
    expect(activePath(navFor('client'), '/privacy')).toBeUndefined();
  });
});
