import React from 'react';

interface RatingInputProps {
  value: number;
  onChange: (n: number) => void;
  label: string;
}

/** 1–5 radio group rendered as plain numbers. */
export const RatingInput: React.FC<RatingInputProps> = ({ value, onChange, label }) => {
  const name = React.useId();
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="text-meta font-medium text-text mb-8">{label}</legend>
      <div className="flex gap-8">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={`relative inline-flex items-center justify-center w-40 h-40 rounded-md border font-mono tabular-nums cursor-pointer transition-colors duration-120 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === n ? 'bg-text text-bg border-text' : 'border-border-strong text-text-dim hover:text-text hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
