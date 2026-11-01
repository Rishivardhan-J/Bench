import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

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

export const PageLoading: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <div role="status" className="flex items-center justify-center py-64 text-text-dim text-body">
    {label}…
  </div>
);
