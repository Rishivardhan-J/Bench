import React from 'react';
import { ChevronDown } from 'lucide-react';

const field =
  'w-full rounded-md border border-border bg-surface px-12 text-body text-text placeholder:text-text-mute transition-colors duration-120 hover:border-border-strong focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-text';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => (
  <input ref={ref} className={`${field} h-40 ${className}`} {...props} />
));
Input.displayName = 'Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = '', ...props }, ref) => (
  <textarea ref={ref} className={`${field} min-h-area py-12 resize-y ${className}`} {...props} />
));
Textarea.displayName = 'Textarea';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className = '', children, ...props }, ref) => (
  <div className="relative w-full">
    <select ref={ref} className={`${field} h-40 appearance-none pr-32 ${className}`} {...props}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-12 top-12 w-16 h-16 text-text-dim" aria-hidden="true" />
  </div>
));
Select.displayName = 'Select';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ label, className = '', id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={`inline-flex items-center gap-8 text-body text-text-dim cursor-pointer ${className}`}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="w-16 h-16 rounded-badge border border-border-strong bg-surface accent-white cursor-pointer"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});
Checkbox.displayName = 'Checkbox';
