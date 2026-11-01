import React from 'react';
import { X } from 'lucide-react';

const base =
  'inline-flex items-center justify-center gap-4 rounded-sm text-11 font-sans px-8 py-4 border whitespace-nowrap transition-colors duration-120';

const neutral = 'bg-surface-3 border-border text-text-dim';

/** A non-interactive label such as a skill on a profile. */
export const Tag: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className = '', ...props }) => (
  <span className={`${base} ${neutral} ${className}`} {...props} />
);

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** A toggle: announces its pressed state to assistive technology. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className = '', selected = false, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      className={`${base} cursor-pointer active:scale-97 ${
        selected ? 'bg-accent-dim border-accent-dim text-accent-text font-medium' : `${neutral} hover:text-text`
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
Chip.displayName = 'Chip';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

/** A removable filter chip; fades in at 150ms per the design system. */
export const FilterChip: React.FC<FilterChipProps> = ({ label, onRemove, className = '' }) => (
  <span className={`${base} ${neutral} animate-fade-in pl-8 pr-4 ${className}`}>
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter ${label}`}
      className="inline-flex items-center justify-center w-16 h-16 rounded-badge text-text-dim hover:text-text hover:bg-surface-2"
    >
      <X className="w-12 h-12" aria-hidden="true" />
    </button>
  </span>
);
