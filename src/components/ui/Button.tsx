import React from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-8 font-sans font-semibold rounded-md whitespace-nowrap select-none transition duration-120 active:scale-97 disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-text text-bg hover:bg-text-dim',
  secondary: 'bg-transparent border border-border-strong text-text hover:bg-surface-2',
  ghost: 'bg-transparent text-text-dim hover:text-text hover:bg-surface-2',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-32 px-12 text-meta',
  md: 'h-40 px-16 text-body',
  lg: 'h-48 px-24 text-body',
};

export function buttonStyles(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  const { variant = 'primary', size = 'md', className = '' } = opts;
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading && <Loader2 className="w-16 h-16 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const ButtonLink: React.FC<ButtonLinkProps> = ({ variant, size, className, ...props }) => (
  <Link className={buttonStyles({ variant, size, className })} {...props} />
);
