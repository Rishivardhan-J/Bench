import React from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Modal built on the native <dialog>: the browser traps focus, makes the rest of the
 * page inert, closes on Escape and restores focus to the trigger.
 */
export const Dialog: React.FC<DialogProps> = ({ open, onClose, title, description, children }) => {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      document.documentElement.style.overflow = 'hidden';
      // The browser focuses the close button first; a form dialog should start on its first field.
      el.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]), textarea, select')?.focus();
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
    if (!open) document.documentElement.style.overflow = '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-full max-w-modal rounded-lg animate-fade-in"
    >
      {open && (
        <div className="relative p-32">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-16 right-16 inline-flex items-center justify-center w-32 h-32 rounded-sm text-text-dim hover:text-text hover:bg-surface-2"
          >
            <X className="w-16 h-16" aria-hidden="true" />
          </button>
          <h2 id={titleId} className="text-section-heading text-text mb-8 pr-32">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-body text-text-dim mb-24">
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
};
