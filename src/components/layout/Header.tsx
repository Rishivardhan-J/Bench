import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Command } from 'lucide-react';
import { useAuth } from '@/lib/providers/AuthContext';
import { useNotifications } from '@/lib/data/notifications';
import { useThreads } from '@/lib/data/messaging';
import { Menu } from '@/components/ui/Menu';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePrefetch } from '@/hooks/usePrefetch';
import { readCachedRole } from '@/lib/roleCache';
import { NavItems } from './NavItems';
import { accountMenuFor, navFor } from './navigation';

export const Header: React.FC<{ onOpenPalette: () => void }> = ({ onOpenPalette }) => {
  const { currentUser, role, isAdmin, isAuthLoading, openSignInModal, signOut } = useAuth();
  const uid = currentUser?.uid ?? null;
  // While auth resolves, fall back to the last known role so the right links show on first paint.
  const cachedRole = React.useMemo(() => readCachedRole(), []);
  const effectiveRole = isAuthLoading ? cachedRole : isAdmin ? 'admin' : role;
  const prefetch = usePrefetch();
  const [scrolled, setScrolled] = React.useState(false);

  const { data: notifications } = useNotifications(uid);
  const { data: threads } = useThreads(uid);
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessages = threads.reduce((sum, t) => sum + (uid ? t.unread[uid] ?? 0 : 0), 0);

  const nav = navFor(effectiveRole);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Once the person is known, warm the pages they are most likely to open next.
  React.useEffect(() => {
    if (isAuthLoading) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const run = () => nav.forEach((i) => prefetch(i.to));
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const id = idle ? idle(run) : window.setTimeout(run, 800);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, [isAuthLoading, effectiveRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const navPending = isAuthLoading && !cachedRole;
  const displayName = currentUser?.email ?? 'Account';

  return (
    <header className={`w-full border-b bg-bg sticky top-0 z-40 transition-colors duration-150 ${scrolled ? 'border-border-strong' : 'border-border'}`}>
      <div className="max-w-page mx-auto px-16 sm:px-24 h-64 flex items-center justify-between gap-16">
        <div className="flex items-center gap-24 min-w-0">
          <Link to="/" className="text-section-heading text-text rounded-sm">
            Bench
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            {navPending ? (
              <div className="flex gap-8" aria-hidden="true">{[0, 1, 2].map((i) => (<Skeleton key={i} className="w-64 h-32" />))}</div>
            ) : (
              <NavItems items={nav} unreadMessages={unreadMessages} onPrefetch={prefetch} heightClass="h-32" />
            )}
          </nav>
        </div>

        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Open command palette"
            className="hidden sm:inline-flex items-center gap-8 h-32 px-12 rounded-md border border-border text-meta text-text-dim hover:text-text hover:border-border-strong transition-colors duration-120"
          >
            <Command className="w-12 h-12" aria-hidden="true" />
            <span className="font-mono text-11">K</span>
          </button>

          {isAuthLoading && (
            <div className="flex items-center gap-8" aria-hidden="true">
              {cachedRole ? (<><Skeleton className="w-32 h-32 rounded-md" /><Skeleton className="w-32 h-32 rounded-full" /></>) : (<Skeleton className="w-64 h-32" />)}
            </div>
          )}

          {!isAuthLoading && currentUser && (
            <>
              <Link
                to="/notifications"
                aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
                className="relative inline-flex items-center justify-center w-32 h-32 rounded-md text-text-dim hover:text-text hover:bg-surface-2 transition-colors duration-120"
              >
                <Bell className="w-16 h-16" aria-hidden="true" />
                {unreadNotifications > 0 && <span className="absolute top-4 right-4 w-8 h-8 rounded-full bg-accent" aria-hidden="true" />}
              </Link>
              <Menu
                label="Account menu"
                trigger={<Avatar name={displayName} size="md" className="border border-border" />}
                items={[
                  ...accountMenuFor(effectiveRole).map((i) => ({ label: i.label, to: i.to })),
                  { label: 'Sign out', onSelect: () => void signOut() },
                ]}
              />
            </>
          )}

          {!isAuthLoading && !currentUser && (
            <>
              <Link to="/for-freelancers" className="hidden sm:inline-flex items-center h-32 px-12 text-body text-text-dim hover:text-text rounded-md">
                For freelancers
              </Link>
              <Button variant="secondary" size="sm" onClick={() => openSignInModal({ mode: 'signin' })}>
                Sign in
              </Button>
            </>
          )}
        </div>
      </div>

      <nav aria-label="Main" className="md:hidden border-t border-border overflow-x-auto no-scrollbar scroll-smooth">
        <div className="px-16 py-4 w-max min-w-full">
          {navPending ? (
            <div className="flex gap-8 h-40 items-center" aria-hidden="true">{[0, 1, 2].map((i) => (<Skeleton key={i} className="w-64 h-32" />))}</div>
          ) : (
            <NavItems items={nav} unreadMessages={unreadMessages} onPrefetch={prefetch} heightClass="h-40" centerActive />
          )}
        </div>
      </nav>
    </header>
  );
};
