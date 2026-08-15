import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, actionLabel, onAction, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-32 text-center ${className}`}>
      <p className="text-text-dim text-body mb-8">{message}</p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="text-text-dim hover:text-text text-body underline underline-offset-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-32 text-center ${className}`}>
      <AlertCircle className="w-24 h-24 text-text-dim mb-12" />
      <p className="text-text text-body mb-16">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
};
