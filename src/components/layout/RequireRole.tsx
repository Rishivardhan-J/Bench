import React from 'react';
import { useAuth } from '@/lib/providers/AuthContext';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageLoading } from '@/components/ui/States';
import type { Role } from '@/types';
import { Page } from './Page';

interface RequireRoleProps {
  /** Omit to allow any signed-in user. */
  role?: Role;
  children: React.ReactNode;
}

/** Gates a page by role. The same rule is enforced again by Firestore rules and Cloud Functions. */
export const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
  const { currentUser, role: actual, isAdmin, isAuthLoading, openSignInModal } = useAuth();

  if (isAuthLoading) return <PageLoading />;

  if (!currentUser) {
    return (
      <Page width="narrow">
        <EmptyState
          title="Sign in to continue"
          message={!role ? 'Sign in to see this page.' : role === 'freelancer' ? 'This page is for freelancer accounts.' : role === 'admin' ? 'This page is for the Bench team.' : 'This page is for client accounts.'}
          action={
            <Button onClick={() => openSignInModal({ mode: 'signin' })}>Sign in</Button>
          }
        />
      </Page>
    );
  }

  const allowed = !role || (role === 'admin' ? isAdmin : actual === role);
  if (!allowed) {
    return (
      <Page width="narrow">
        <EmptyState
          title="This page isn't available for your account"
          message={
            role === 'freelancer'
              ? 'Freelancer pages are only for freelancer accounts.'
              : role === 'admin'
                ? 'Only the Bench team can open this page.'
                : 'Client pages are only for client accounts.'
          }
        />
      </Page>
    );
  }
  return <>{children}</>;
};
