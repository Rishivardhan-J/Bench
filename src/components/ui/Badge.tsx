import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center justify-center rounded-badge bg-accent-dim text-accent-text text-11 font-medium leading-none px-8 py-4 ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
