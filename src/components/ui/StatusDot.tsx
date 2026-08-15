import React from 'react';
import type { Freelancer } from '@/types';

interface StatusDotProps {
  status: Freelancer['availability'];
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, className = '' }) => {
  const getColors = () => {
    switch (status) {
      case 'now':
      case 'this_week':
        return 'bg-text border-text'; // white
      case 'busy':
        return 'bg-text-dim border-text-dim'; // gray
      case 'offline':
      default:
        return 'bg-transparent border-border-strong border-2'; // dark gray ring
    }
  };

  return (
    <span
      className={`inline-block w-8 h-8 rounded-full border ${getColors()} ${className}`}
      aria-hidden="true"
    />
  );
};
