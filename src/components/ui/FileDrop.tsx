import React from 'react';
import { Upload } from 'lucide-react';
import { formatBytes } from '@/lib/format';

interface FileDropProps {
  label: string;
  hint?: string;
  accept: string;
  maxBytes: number;
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Called with a validation message; null clears it. */
  onError?: (message: string | null) => void;
  buttonLabel?: string;
}

function matchesAccept(file: File, accept: string): boolean {
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .some((rule) => {
      if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
      if (rule.endsWith('/*')) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
      return file.type.toLowerCase() === rule;
    });
}

export const FileDrop: React.FC<FileDropProps> = ({
  label,
  hint,
  accept,
  maxBytes,
  onFile,
  disabled,
  onError,
  buttonLabel = 'Choose file',
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const setError = (m: string | null) => {
    setLocalError(m);
    onError?.(m);
  };

  const handle = (file: File | undefined) => {
    if (!file) return;
    if (!matchesAccept(file, accept)) return setError('That file type is not supported.');
    if (file.size > maxBytes) return setError(`File must be smaller than ${formatBytes(maxBytes)}.`);
    setError(null);
    onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handle(e.dataTransfer.files?.[0]);
      }}
      className={`flex flex-col sm:flex-row sm:items-center gap-12 p-16 rounded-md border border-dashed transition-colors duration-120 ${
        dragging ? 'border-text bg-surface-2' : 'border-border-strong bg-surface'
      }`}
    >
      <Upload className="w-20 h-20 text-text-dim flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-body text-text">{label}</p>
        {hint && <p className="text-meta text-text-dim">{hint}</p>}
        {localError && (
          <p role="alert" className="text-meta text-text mt-4">
            {localError}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center justify-center h-32 px-12 rounded-md border border-border-strong text-meta font-semibold text-text hover:bg-surface-2 disabled:opacity-50"
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
};
