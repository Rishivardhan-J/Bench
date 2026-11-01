import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, actionLabel, onAction, action, className = '' }) => (
  <div role="status" className={`flex flex-col items-center justify-center p-32 text-center ${className}`}>
    {title && <h2 className="text-section-heading text-text mb-8">{title}</h2>}
    <p className="text-text-dim text-body mb-16 max-w-prose">{message}</p>
    {action}
    {actionLabel && onAction && (
      <Button variant="secondary" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className = '' }) => (
  <div role="alert" className={`flex flex-col items-center justify-center p-32 text-center ${className}`}>
    <AlertCircle className="w-24 h-24 text-text-dim mb-12" aria-hidden="true" />
    <p className="text-text text-body mb-16">{message}</p>
    {onRetry && (
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);

/**
 * Layout-shaped placeholder for a page that is still downloading. It waits briefly before appearing,
 * so a fast load never flashes a loader at all.
 */
export const PageLoading: React.FC<{ label?: string; delay?: number }> = ({ label = 'Loading', delay = 150 }) => {
  const [visible, setVisible] = React.useState(delay === 0);
  React.useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-page px-16 sm:px-24 py-32 sm:py-48 animate-fade-in">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-32 w-200 mb-16" />
      <Skeleton className="h-16 w-320 mb-32" />
      <Skeleton className="h-96 w-full mb-12" />
      <Skeleton className="h-96 w-full mb-12" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
};
