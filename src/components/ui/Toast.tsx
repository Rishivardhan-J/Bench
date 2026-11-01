import React from 'react';
import { X } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  /** Visible toast, also announced politely. */
  toast: (message: string) => void;
  /** Screen-reader only announcement (async status such as "12 freelancers"). */
  announce: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [announcement, setAnnouncement] = React.useState('');
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);

  const toast = React.useCallback(
    (message: string) => {
      const id = nextId.current++;
      setItems((cur) => [...cur.slice(-2), { id, message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const announce = React.useCallback((message: string) => {
    // Clear first so repeating the same text is still announced.
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(message), 50);
  }, []);

  const value = React.useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-8 px-16 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-12 bg-surface-3 border border-border-strong rounded-md pl-16 pr-8 py-8 text-body text-text animate-rise-in"
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="inline-flex items-center justify-center w-24 h-24 rounded-sm text-text-dim hover:text-text"
            >
              <X className="w-16 h-16" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return { toast: () => undefined, announce: () => undefined };
  return ctx;
}
