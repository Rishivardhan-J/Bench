import React from 'react';

interface ProgressMeterProps {
  value: number;
  label: string;
  className?: string;
}

export const ProgressMeter: React.FC<ProgressMeterProps> = ({ value, label, className = '' }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-8">
        <span className="text-meta text-text-dim">{label}</span>
        <span className="font-mono tabular-nums text-meta text-text">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-4 w-full rounded-badge bg-surface-3 overflow-hidden"
      >
        <div className="h-full bg-text transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
