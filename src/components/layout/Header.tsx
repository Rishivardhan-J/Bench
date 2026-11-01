import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Bell, Command } from 'lucide-react';
import { useAuth } from '@/lib/providers/AuthContext';
import { useNotifications } from '@/lib/data/notifications';
import { useThreads } from '@/lib/data/messaging';
import { Menu } from '@/components/ui/Menu';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { accountMenuFor, navFor } from './navigation';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative inline-flex items-center gap-8 h-32 px-12 rounded-md text-body transition-colors duration-120 ${
    isActive ? 'text-text bg-surface-3' : 'text-text-dim hover:text-text hover:bg-surface-2'
  }`;

const Dot: React.FC<{ label: string }> = ({ label }) => (
  <>
    <span className="w-8 h-8 rounded-full bg-accent" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </>
);

export const Header: React.FC<{ onOpenPalette: () => void }> = ({ onOpenPalette }) => {
  const { currentUser, role, isAdmin, isAuthLoading, openSignInModal, signOut } = useAuth();
  const uid = currentUser?.uid ?? null;
  const effectiveRole = isAdmin ? 'admin' : role;

  const { data: notifications } = useNotifications(uid);
  const { data: threads } = useThreads(uid);
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessages = threads.reduce((sum, t) => sum + (uid ? t.unread[uid] ?? 0 : 0), 0);

  const nav = navFor(effectiveRole);
  const displayName = currentUser?.email ?? 'Account';

  return (
    <header className="w-full border-b border-border bg-bg sticky top-0 z-40">
      <div className="max-w-page mx-auto px-16 sm:px-24 h-64 flex items-center justify-between gap-16">
        <div className="flex items-center gap-24 min-w-0">
          <Link to="/" className="text-section-heading text-text rounded-sm">
            Bench
          </Link>
          <nav aria-label="Main" className="hidden md:flex items-center gap-4">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                {item.label}
                {item.label === 'Messages' && unreadMessages > 0 && <Dot label={`${unreadMessages} unread`} />}
              </NavLink>
            ))}
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

      <nav aria-label="Main" className="md:hidden border-t border-border overflow-x-auto">
        <div className="flex items-center gap-4 px-16 h-48 w-max min-w-full">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              {item.label}
              {item.label === 'Messages' && unreadMessages > 0 && <Dot label={`${unreadMessages} unread`} />}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
};
