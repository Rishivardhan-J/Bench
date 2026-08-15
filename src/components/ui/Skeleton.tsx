import React from 'react';

export const Skeleton = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-2 ${className}`}
      {...props}
    />
  );
};
