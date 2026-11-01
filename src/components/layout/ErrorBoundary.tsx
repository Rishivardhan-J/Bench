import React from 'react';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/Button';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="max-w-narrow mx-auto px-24 py-96 text-center">
        <h1 className="text-page-heading text-text mb-12">Something went wrong</h1>
        <p className="text-body text-text-dim mb-24">The page hit an unexpected problem. Reloading usually fixes it.</p>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    );
  }
}
