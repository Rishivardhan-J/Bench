import React from 'react';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  interactive?: boolean;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className = '', selected = false, interactive = true, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-sm text-11 font-sans px-8 py-4 border whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent';
    
    const stateStyles = selected
      ? 'bg-accent-dim border-accent-dim text-accent-text font-medium'
      : 'bg-surface-3 border-border text-text-dim hover:text-text';
      
    const interactiveStyles = interactive ? 'cursor-pointer active:scale-95' : 'cursor-default';

    return (
      <button
        ref={ref}
        type="button"
        className={`${baseStyles} ${stateStyles} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Chip.displayName = 'Chip';
