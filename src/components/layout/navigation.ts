import type { Role } from '@/types';

export interface NavItem {
  label: string;
  to: string;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

export function navFor(role: Role | null): NavItem[] {
  if (role === 'admin') return [{ label: 'Review queue', to: '/admin' }, { label: 'Reports', to: '/admin/reports' }, { label: 'Search', to: '/' }];
  if (role === 'freelancer') {
    return [
      { label: 'Profile', to: '/freelancer/profile', keywords: 'edit resume' },
      { label: 'Status', to: '/freelancer/status', keywords: 'review live pending' },
      { label: 'Requests', to: '/freelancer/requests', keywords: 'inbox connect' },
      { label: 'Project board', to: '/freelancer/board', keywords: 'projects proposals' },
      { label: 'Analytics', to: '/freelancer/analytics', keywords: 'views stats' },
      { label: 'Messages', to: '/messages' },
    ];
  }
  return [
    { label: 'Search', to: '/', keywords: 'find freelancers' },
    { label: 'Shortlists', to: '/shortlists', keywords: 'saved lists' },
    { label: 'Projects', to: '/projects', keywords: 'post proposals' },
    { label: 'Messages', to: '/messages' },
  ];
}

export function accountMenuFor(role: Role | null): NavItem[] {
  const common = [{ label: 'Notifications', to: '/notifications' }, { label: 'Settings', to: '/settings' }];
  if (role === 'freelancer') return [{ label: 'Your profile', to: '/freelancer/profile' }, { label: 'Status', to: '/freelancer/status' }, ...common];
  if (role === 'admin') return [{ label: 'Review queue', to: '/admin' }, ...common];
  return [{ label: 'Shortlists', to: '/shortlists' }, { label: 'Saved searches', to: '/settings#saved-searches' }, ...common];
}

/** The single active item: the longest matching path wins, so /admin does not light up on /admin/reports. */
export function activePath(items: NavItem[], pathname: string): string | undefined {
  const matches = items.filter((i) => (i.to === '/' ? pathname === '/' : pathname === i.to || pathname.startsWith(`${i.to}/`)));
  return matches.sort((a, b) => b.to.length - a.to.length)[0]?.to;
}
