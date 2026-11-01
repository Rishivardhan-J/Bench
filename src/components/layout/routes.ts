import React from 'react';

/**
 * Every routed page as a lazily loaded chunk. The same loaders power route prefetching, so
 * hovering a nav link starts the download before the click and the page opens without a wait.
 */
type Loader = () => Promise<Record<string, React.ComponentType>>;

const defs = {
  SearchPage: ['/features/search/SearchPage', () => import('@/features/search/SearchPage')],
  FreelancerDetail: ['/features/profile/FreelancerDetail', () => import('@/features/profile/FreelancerDetail')],
  ShortlistsPage: ['/features/shortlist/ShortlistsPage', () => import('@/features/shortlist/ShortlistsPage')],
  ComparePage: ['/features/shortlist/ComparePage', () => import('@/features/shortlist/ComparePage')],
  FreelancerLandingPage: ['/features/freelancer/FreelancerLandingPage', () => import('@/features/freelancer/FreelancerLandingPage')],
  FreelancerProfilePage: ['/features/freelancer/FreelancerProfilePage', () => import('@/features/freelancer/FreelancerProfilePage')],
  StatusPage: ['/features/freelancer/StatusPage', () => import('@/features/freelancer/StatusPage')],
  RequestsPage: ['/features/freelancer/RequestsPage', () => import('@/features/freelancer/RequestsPage')],
  ProjectBoardPage: ['/features/freelancer/ProjectBoardPage', () => import('@/features/freelancer/ProjectBoardPage')],
  AnalyticsPage: ['/features/freelancer/AnalyticsPage', () => import('@/features/freelancer/AnalyticsPage')],
  MessagesPage: ['/features/messaging/MessagesPage', () => import('@/features/messaging/MessagesPage')],
  NotificationsPage: ['/features/notifications/NotificationsPage', () => import('@/features/notifications/NotificationsPage')],
  SettingsPage: ['/features/settings/SettingsPage', () => import('@/features/settings/SettingsPage')],
  ProjectsPage: ['/features/projects/ProjectsPage', () => import('@/features/projects/ProjectsPage')],
  NewProjectPage: ['/features/projects/NewProjectPage', () => import('@/features/projects/NewProjectPage')],
  ProjectDetailPage: ['/features/projects/ProjectDetailPage', () => import('@/features/projects/ProjectDetailPage')],
  AdminQueuePage: ['/features/admin/AdminQueuePage', () => import('@/features/admin/AdminQueuePage')],
  AdminReportsPage: ['/features/admin/AdminReportsPage', () => import('@/features/admin/AdminReportsPage')],
  PrivacyPage: ['/pages/PrivacyPage', () => import('@/pages/PrivacyPage')],
  TermsPage: ['/pages/TermsPage', () => import('@/pages/TermsPage')],
  NotFoundPage: ['/pages/NotFoundPage', () => import('@/pages/NotFoundPage')],
} as const satisfies Record<string, readonly [string, Loader]>;

export type PageName = keyof typeof defs;

const started = new Map<PageName, Promise<unknown>>();

/** Starts (once) and returns the download of a page chunk. */
export function loadPage(name: PageName): Promise<unknown> {
  let p = started.get(name);
  if (!p) {
    p = (defs[name][1] as Loader)().catch((err) => {
      started.delete(name); // allow a retry after a network failure
      throw err;
    });
    started.set(name, p);
  }
  return p;
}

export const pages = Object.fromEntries(
  (Object.keys(defs) as PageName[]).map((name) => [
    name,
    React.lazy(async () => ({ default: ((await loadPage(name)) as Record<string, React.ComponentType>)[name] })),
  ]),
) as Record<PageName, React.LazyExoticComponent<React.ComponentType>>;

/** Which page a URL path renders. Mirrors the route table in App.tsx. */
export function pageForPath(path: string): PageName | null {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const exact: Record<string, PageName> = {
    '/': 'SearchPage',
    '/for-freelancers': 'FreelancerLandingPage',
    '/privacy': 'PrivacyPage',
    '/terms': 'TermsPage',
    '/messages': 'MessagesPage',
    '/notifications': 'NotificationsPage',
    '/settings': 'SettingsPage',
    '/shortlists': 'ShortlistsPage',
    '/compare': 'ComparePage',
    '/projects': 'ProjectsPage',
    '/projects/new': 'NewProjectPage',
    '/freelancer/profile': 'FreelancerProfilePage',
    '/freelancer/status': 'StatusPage',
    '/freelancer/requests': 'RequestsPage',
    '/freelancer/board': 'ProjectBoardPage',
    '/freelancer/analytics': 'AnalyticsPage',
    '/admin': 'AdminQueuePage',
    '/admin/reports': 'AdminReportsPage',
  };
  if (exact[p]) return exact[p];
  if (p.startsWith('/messages/')) return 'MessagesPage';
  if (p.startsWith('/projects/')) return 'ProjectDetailPage';
  if (p.startsWith('/freelancer/')) return 'FreelancerDetail';
  return null;
}

/** Warm the chunk for a path. Safe to call repeatedly and never throws. */
export function prefetchRoute(path: string): void {
  const name = pageForPath(path);
  if (name) void loadPage(name).catch(() => undefined);
}

/** Collapses URLs that render the same page so a transition only plays between genuinely different pages. */
export function pageKey(pathname: string): string {
  if (pathname.startsWith('/messages')) return '/messages';
  return pathname;
}
