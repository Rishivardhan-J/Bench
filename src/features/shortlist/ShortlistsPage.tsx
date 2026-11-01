import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Page, PageHeader } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusDot } from '@/components/ui/StatusDot';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useShortlist } from '@/lib/providers/ShortlistContext';
import { getProvider } from '@/lib/providers';
import { availabilityLabel, formatRate, formatRating } from '@/lib/format';
import type { ShortlistEntry } from '@/types';

const NoteField: React.FC<{ entry: ShortlistEntry; onSave: (note: string) => void }> = ({ entry, onSave }) => {
  const [value, setValue] = React.useState(entry.note);
  React.useEffect(() => setValue(entry.note), [entry.note]);
  return (
    <Textarea
      aria-label="Private note"
      placeholder="Private note, only you can see this"
      rows={2}
      maxLength={500}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== entry.note && onSave(value)}
      className="min-h-0 text-meta"
    />
  );
};

export const ShortlistsPage: React.FC = () => {
  const provider = React.useMemo(() => getProvider(), []);
  const { lists, isLoading, removeFromList, setNote, moveItem, createList, renameList, deleteList } = useShortlist();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [compare, setCompare] = React.useState<string[]>([]);
  const [dialog, setDialog] = React.useState<'new' | 'rename' | 'delete' | null>(null);
  const [nameInput, setNameInput] = React.useState('');

  const selected = lists.find((l) => l.id === params.get('list')) ?? lists[0];
  const ids = selected?.items.map((i) => i.freelancerId) ?? [];

  const { data: profiles, isLoading: loadingProfiles, isError, refetch } = useQuery({
    queryKey: ['shortlist-profiles', ids.join(',')],
    queryFn: () => provider.getByIds(ids),
    enabled: ids.length > 0,
  });

  React.useEffect(() => setCompare([]), [selected?.id]);

  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));

  const submitDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (dialog === 'new') {
        const id = await createList(nameInput);
        setParams({ list: id }, { replace: true });
      } else if (dialog === 'rename' && selected) await renameList(selected.id, nameInput);
      setDialog(null);
    } catch {
      toast("Couldn't save that. Please try again.");
    }
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      await deleteList(selected.id);
      setParams({}, { replace: true });
      toast(`Deleted ${selected.name}`);
    } catch {
      toast("Couldn't delete that list.");
    }
    setDialog(null);
  };

  if (isLoading) {
    return (
      <Page title="Shortlists">
        <PageHeader title="Shortlists" />
        <div aria-busy="true"><span className="sr-only" role="status">Loading shortlists</span><Skeleton className="h-64 w-full mb-12" /><Skeleton className="h-64 w-full" /></div>
      </Page>
    );
  }

  if (lists.length === 0) {
    return (
      <Page title="Shortlists">
        <PageHeader title="Shortlists" />
        <EmptyState
          title="No shortlists yet"
          message="Save freelancers from search to build a list you can compare and come back to."
          action={<ButtonLink to="/">Find freelancers</ButtonLink>}
        />
      </Page>
    );
  }

  return (
    <Page title="Shortlists">
      <PageHeader
        title="Shortlists"
        description="Keep notes on each person and compare up to three side by side."
        actions={
          <>
            <Button variant="secondary" onClick={() => { setNameInput(''); setDialog('new'); }}>New list</Button>
            {selected && (
              <Menu
                label={`Manage ${selected.name}`}
                trigger={<span className="inline-flex items-center justify-center h-40 px-16 rounded-md border border-border-strong text-body font-semibold text-text hover:bg-surface-2">Manage list</span>}
                items={[
                  { label: 'Rename', onSelect: () => { setNameInput(selected.name); setDialog('rename'); } },
                  { label: 'Delete', onSelect: () => setDialog('delete') },
                ]}
              />
            )}
          </>
        }
      />

      <div className="mb-24 max-w-320">
        <Field label="List">
          <Select value={selected?.id} onChange={(e) => setParams({ list: e.target.value }, { replace: true })}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.items.length})</option>
            ))}
          </Select>
        </Field>
      </div>

      {isError ? (
        <ErrorState message="We couldn't load this list." onRetry={() => refetch()} />
      ) : ids.length === 0 ? (
        <EmptyState message="This list is empty. Save freelancers from search to add them here." action={<ButtonLink to="/" variant="secondary">Find freelancers</ButtonLink>} />
      ) : loadingProfiles ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading list</span><Skeleton className="h-96 w-full mb-12" /><Skeleton className="h-96 w-full" /></div>
      ) : (
        <>
          <ul className="flex flex-col gap-12 mb-24">
            {selected!.items.map((entry, index) => {
              const f = profiles?.[index] ?? null;
              return (
                <li key={entry.freelancerId} className="border border-border rounded-lg bg-surface p-16 flex flex-col md:flex-row gap-16">
                  {f ? (
                    <>
                      <div className="flex items-start gap-12 md:w-320 flex-shrink-0">
                        <Avatar src={f.avatarUrl} name={f.name} size="lg" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-8 flex-wrap">
                            <Link to={`/freelancer/${f.id}`} className="text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">{f.name}</Link>
                            {f.verified && <VerifiedBadge />}
                          </div>
                          <p className="text-meta text-text-dim">{f.headline}</p>
                          <p className="text-meta text-text-dim font-mono tabular-nums mt-8">
                            {formatRate(f)} · {formatRating(f.ratingAvg) ?? 'New'}
                          </p>
                          <p className="flex items-center gap-8 text-meta text-text-dim mt-4"><StatusDot status={f.availability} />{availabilityLabel(f.availability)}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0"><NoteField entry={entry} onSave={(note) => setNote(selected!.id, entry.freelancerId, note)} /></div>
                    </>
                  ) : (
                    <p className="flex-1 text-body text-text-dim self-center">This profile is no longer available.</p>
                  )}

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-8">
                    <div className="flex items-center gap-4">
                      <button type="button" aria-label={`Move ${f?.name ?? 'profile'} up`} disabled={index === 0} onClick={() => moveItem(selected!.id, index, index - 1)} className="inline-flex items-center justify-center w-32 h-32 rounded-md text-text-dim hover:text-text hover:bg-surface-3 disabled:opacity-50"><ArrowUp className="w-16 h-16" aria-hidden="true" /></button>
                      <button type="button" aria-label={`Move ${f?.name ?? 'profile'} down`} disabled={index === selected!.items.length - 1} onClick={() => moveItem(selected!.id, index, index + 1)} className="inline-flex items-center justify-center w-32 h-32 rounded-md text-text-dim hover:text-text hover:bg-surface-3 disabled:opacity-50"><ArrowDown className="w-16 h-16" aria-hidden="true" /></button>
                      <button type="button" aria-label={`Remove ${f?.name ?? 'profile'} from list`} onClick={() => removeFromList(selected!.id, entry.freelancerId)} className="inline-flex items-center justify-center w-32 h-32 rounded-md text-text-dim hover:text-text hover:bg-surface-3"><Trash2 className="w-16 h-16" aria-hidden="true" /></button>
                    </div>
                    {f && (
                      <label className="flex items-center gap-8 text-meta text-text-dim cursor-pointer">
                        <input type="checkbox" className="w-16 h-16 accent-white" checked={compare.includes(f.id)} disabled={!compare.includes(f.id) && compare.length >= 3} onChange={() => toggleCompare(f.id)} />
                        Compare
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {compare.length >= 2 && <ButtonLink to={`/compare?ids=${compare.join(',')}`}>Compare {compare.length} freelancers</ButtonLink>}
        </>
      )}

      <Dialog open={dialog === 'new' || dialog === 'rename'} onClose={() => setDialog(null)} title={dialog === 'rename' ? 'Rename list' : 'New list'}>
        <form onSubmit={submitDialog} className="flex flex-col gap-16">
          <Field label="Name" required><Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={60} autoFocus /></Field>
          <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" disabled={!nameInput.trim()}>Save</Button></div>
        </form>
      </Dialog>
      <Dialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={`Delete ${selected?.name ?? 'list'}?`} description="This removes the list and your notes. The freelancers themselves are not affected.">
        <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button onClick={confirmDelete}>Delete list</Button></div>
      </Dialog>
    </Page>
  );
};
