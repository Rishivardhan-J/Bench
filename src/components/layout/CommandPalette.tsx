import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/lib/providers/AuthContext';
import { navFor, accountMenuFor } from './navigation';
import type { NavItem } from './navigation';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Cmd/Ctrl+K: jump to search, shortlists, inbox, settings. */
export const CommandPalette: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { role, isAdmin, currentUser } = useAuth();
  const [term, setTerm] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const items = React.useMemo<NavItem[]>(() => {
    const effective = isAdmin ? 'admin' : role;
    const all = [...navFor(effective), ...(currentUser ? accountMenuFor(effective) : [{ label: 'For freelancers', to: '/for-freelancers' }])];
    const seen = new Set<string>();
    return all.filter((i) => (seen.has(i.to) ? false : (seen.add(i.to), true)));
  }, [role, isAdmin, currentUser]);

  const results = items.filter((i) => `${i.label} ${i.keywords ?? ''}`.toLowerCase().includes(term.trim().toLowerCase()));

  React.useEffect(() => {
    if (open) {
      setTerm('');
      setActive(0);
    }
  }, [open]);

  const go = (item: NavItem | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Go to" description="Type to find a page, then press Enter.">
      <input
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        aria-label="Search pages"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search, shortlists, messages…"
        className="w-full h-40 rounded-md border border-border bg-bg px-12 text-body text-text placeholder:text-text-mute mb-12"
      />
      <ul id={listId} role="listbox" aria-label="Pages" className="max-h-320 overflow-y-auto">
        {results.length === 0 && <li className="px-12 py-8 text-body text-text-dim">No matching pages.</li>}
        {results.map((item, i) => (
          <li
            key={item.to}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => setActive(i)}
            onClick={() => go(item)}
            className={`px-12 py-8 rounded-md text-body cursor-pointer ${i === active ? 'bg-surface-3 text-text' : 'text-text-dim'}`}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </Dialog>
  );
};
