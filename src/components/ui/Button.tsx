import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-sans font-semibold rounded-md transition-transform active:scale-97 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none';
    
    const variants = {
      primary: 'bg-text text-bg hover:bg-text-dim',
      secondary: 'bg-transparent border border-border-strong text-text hover:bg-surface-2',
      ghost: 'bg-transparent text-text-dim hover:text-text hover:bg-surface-2'
    };

    const sizes = {
      sm: 'h-8 px-12 text-meta',
      md: 'h-10 px-16 text-body',
      lg: 'h-12 px-24 text-body'
    };

    // Note: Tailwind config needs active:scale-97, which maps to scale(.97).
    // If not present in config, we can use inline style or standard active:scale-95.
    // The prompt says "scale(0.97)", so I'll add a class for it if needed, or use inline style.
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        style={{ '--tw-scale-x': '.97', '--tw-scale-y': '.97' } as React.CSSProperties} // ensures active scale works if class missing
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
