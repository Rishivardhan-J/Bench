import React from 'react';

export const Skeleton = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} aria-hidden="true" {...props} />
);
