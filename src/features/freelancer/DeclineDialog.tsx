import React from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { getProvider } from '@/lib/providers';
import type { DeclineReason, Freelancer } from '@/types';

const REASONS: { id: DeclineReason; label: string }[] = [
  { id: 'booked', label: "I'm fully booked" },
  { id: 'budget', label: "The budget doesn't fit" },
  { id: 'skills', label: "It's outside my skills" },
  { id: 'other', label: 'Something else' },
];

interface Props {
  open: boolean;
  clientName: string;
  busy: boolean;
  /** Excluded from suggestions: the person asking. */
  selfId: string;
  onClose: () => void;
  onConfirm: (reason: DeclineReason, referTo?: string) => void;
}

/** Declining is never a dead end: say why, and optionally point the client to someone else. */
export const DeclineDialog: React.FC<Props> = ({ open, clientName, busy, selfId, onClose, onConfirm }) => {
  const [reason, setReason] = React.useState<DeclineReason>('booked');
  const [search, setSearch] = React.useState('');
  const [people, setPeople] = React.useState<Freelancer[]>([]);
  const [pick, setPick] = React.useState<Freelancer | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setReason('booked');
    setSearch('');
    setPick(null);
    getProvider().search({}).then(setPeople).catch(() => setPeople([]));
  }, [open]);

  const matches = search.trim().length < 2 ? [] : people.filter((p) => p.id !== selfId && p.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 5);

  return (
    <Dialog open={open} onClose={onClose} title={`Decline ${clientName}?`} description="A short reason helps them look elsewhere. They won't see anything else you write.">
      <div className="flex flex-col gap-16">
        <fieldset className="flex flex-col gap-8">
          <legend className="text-meta text-text-dim mb-8">Reason</legend>
          {REASONS.map((r) => (
            <label key={r.id} className="flex items-center gap-8 text-body text-text cursor-pointer">
              <input type="radio" name="decline-reason" className="w-16 h-16 accent-white" checked={reason === r.id} onChange={() => setReason(r.id)} />
              {r.label}
            </label>
          ))}
        </fieldset>

        {pick ? (
          <div className="flex flex-col gap-8">
            <p className="text-meta font-medium text-text">Recommended</p>
            <div className="flex items-center justify-between gap-8 p-12 rounded-md border border-border bg-surface-2">
              <span className="text-body text-text truncate">{pick.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setPick(null)}>Remove</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <Field label="Recommend someone (optional)" hint="Search by name. They'll see a link to that profile.">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Sam Okafor" autoComplete="off" />
            </Field>
            {matches.length > 0 && (
              <ul className="flex flex-col border border-border rounded-md overflow-hidden">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setPick(p)} className="w-full text-left px-12 py-8 text-body text-text hover:bg-surface-2 border-b border-border last:border-b-0">
                      {p.name} <span className="text-text-dim">· {p.headline}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-8">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(reason, pick?.id)} loading={busy}>Decline request</Button>
        </div>
      </div>
    </Dialog>
  );
};
