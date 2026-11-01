import React from 'react';
import { Page } from '@/components/layout/Page';
import { ButtonLink } from '@/components/ui/Button';

export const NotFoundPage: React.FC = () => (
  <Page title="Page not found" width="auth">
    <div className="flex flex-col items-center text-center py-80">
      <p className="font-mono tabular-nums text-page-heading text-text-dim mb-16">404</p>
      <h1 className="text-section-heading text-text mb-12">Page not found</h1>
      <p className="text-body text-text-dim mb-32 max-w-modal">The page you're looking for doesn't exist or has moved.</p>
      <ButtonLink to="/">Back to search</ButtonLink>
    </div>
  </Page>
);
