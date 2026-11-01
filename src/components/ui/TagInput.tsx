import React from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  suggestions?: string[];
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** Type and press Enter or comma to add; each tag has its own remove button. */
export const TagInput: React.FC<TagInputProps> = ({ id, values, onChange, placeholder, max = 30, maxLength = 40, suggestions = [], ...aria }) => {
  const [text, setText] = React.useState('');
  const listId = React.useId();

  const add = (raw: string) => {
    const v = raw.trim().slice(0, maxLength);
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase()) || values.length >= max) return;
    onChange([...values, v]);
  };

  const commit = () => {
    add(text);
    setText('');
  };

  return (
    <div className="flex flex-wrap gap-8 p-8 border border-border rounded-md bg-surface min-h-40 hover:border-border-strong focus-within:border-border-strong">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-4 rounded-sm bg-surface-3 border border-border text-meta text-text pl-8 pr-4 py-2">
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            className="inline-flex items-center justify-center w-16 h-16 rounded-badge text-text-dim hover:text-text hover:bg-surface-2"
          >
            <X className="w-12 h-12" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        list={suggestions.length ? listId : undefined}
        disabled={values.length >= max}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) {
            add(v.slice(0, -1));
            setText('');
          } else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length >= max ? `Up to ${max}` : placeholder}
        className="flex-1 min-w-120 h-24 bg-transparent text-body text-text placeholder:text-text-mute"
        {...aria}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !values.includes(s)).slice(0, 50).map((s) => (<option key={s} value={s} />))}
        </datalist>
      )}
    </div>
  );
};
