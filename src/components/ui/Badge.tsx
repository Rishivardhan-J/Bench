import React from 'react';
import { BadgeCheck } from 'lucide-react';

export const Badge = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className = '', children, ...props }, ref) => (
    <span
      ref={ref}
      className={`inline-flex items-center justify-center gap-4 rounded-badge bg-accent-dim text-accent-text text-11 font-medium leading-none px-8 py-4 ${className}`}
      {...props}
    >
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';

/** Verified means one thing only: the Bench team checked portfolio or LinkedIn and email. */
export const VerifiedBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Badge className={className} title="Bench checked this person's portfolio or LinkedIn, and email">
    <BadgeCheck className="w-12 h-12" aria-hidden="true" />
    Verified
  </Badge>
);

/** A neutral status pill (no accent). */
export const Pill: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className = '', ...props }) => (
  <span
    className={`inline-flex items-center rounded-badge border border-border bg-surface-2 text-text-dim text-11 font-medium leading-none px-8 py-4 ${className}`}
    {...props}
  />
);
