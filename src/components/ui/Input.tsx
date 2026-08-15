import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex h-10 w-full rounded-md border border-border bg-surface px-12 py-8 text-body text-text placeholder:text-text-mute focus:outline-none focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`flex min-h-[120px] w-full rounded-md border border-border bg-surface px-16 py-12 text-body text-text placeholder:text-text-mute focus:outline-none focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 resize-y ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
