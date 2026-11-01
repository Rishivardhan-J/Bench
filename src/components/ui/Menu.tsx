import React from 'react';
import { Link } from 'react-router-dom';

export interface MenuItem {
  label: string;
  to?: string;
  onSelect?: () => void;
}

interface MenuProps {
  /** Accessible name for the trigger button. */
  label: string;
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export const Menu: React.FC<MenuProps> = ({ label, trigger, items, align = 'right' }) => {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  const focusItem = (index: number) => {
    const nodes = wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!nodes || nodes.length === 0) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  React.useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const nodes = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const idx = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(idx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(nodes.length - 1);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const itemClass =
    'block w-full text-left px-16 py-8 text-body text-text-dim hover:text-text hover:bg-surface-2 focus:bg-surface-2 focus:text-text';

  return (
    <div className="relative" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex items-center justify-center rounded-full"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full mt-8 w-200 bg-surface-3 border border-border rounded-md py-4 z-50 animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                onClick={() => close(false)}
                className={itemClass}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  close(false);
                  item.onSelect?.();
                }}
                className={itemClass}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
};
