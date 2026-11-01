import React from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** A single form control; Field wires id, aria-describedby and aria-invalid onto it. */
  children: React.ReactElement<Record<string, unknown>>;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, className = '', children }) => {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id: (children.props.id as string | undefined) ?? id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  });
  const controlId = (children.props.id as string | undefined) ?? id;

  return (
    <div className={`flex flex-col gap-8 ${className}`}>
      <label htmlFor={controlId} className="text-meta font-medium text-text">
        {label}
        {required && <span className="text-text-dim" aria-hidden="true"> *</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-meta text-text-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-meta text-text">
          {error}
        </p>
      )}
    </div>
  );
};
