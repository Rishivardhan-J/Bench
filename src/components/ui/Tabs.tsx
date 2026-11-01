import React from 'react';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

/** Tab strip (roving tabindex, arrow keys). Render the matching panel yourself with role="tabpanel". */
export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, label, className = '' }) => {
  const base = React.useId();
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[tabs[next].id]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={label} className={`flex gap-4 border-b border-border ${className}`}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`${base}-${t.id}`}
            aria-selected={active}
            aria-controls={`${base}-${t.id}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`h-40 px-12 text-body border-b-2 -mb-2 transition-colors duration-120 ${
              active ? 'border-text text-text font-medium' : 'border-transparent text-text-dim hover:text-text'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-8 font-mono tabular-nums text-meta text-text-dim">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export const tabPanelProps = (base: string, id: string) => ({
  role: 'tabpanel' as const,
  id: `${base}-${id}-panel`,
  'aria-labelledby': `${base}-${id}`,
  tabIndex: 0,
});
