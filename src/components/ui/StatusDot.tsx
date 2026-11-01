import React from 'react';
import type { Availability } from '@/types';

// Status is white, grey or hollow. Never green, red or amber.
const styles: Record<Availability, string> = {
  now: 'bg-text border-text',
  this_week: 'bg-text border-text',
  busy: 'bg-text-dim border-text-dim',
  offline: 'bg-transparent border-border-strong',
};

export const StatusDot: React.FC<{ status: Availability; className?: string }> = ({ status, className = '' }) => (
  <span
    className={`inline-block w-8 h-8 rounded-full border-2 flex-shrink-0 ${styles[status] ?? styles.offline} ${className}`}
    aria-hidden="true"
  />
);
