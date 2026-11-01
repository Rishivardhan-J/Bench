import React from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/data/api';
import { lookupUser, reviewProfile, setVerified, usePendingProfiles } from '@/lib/data/profile';
import { formatRate } from '@/lib/format';
import type { Freelancer } from '@/types';

type Found = Awaited<ReturnType<typeof lookupUser>>;

export const AdminQueuePage: React.FC = () => {
  const { toast } = useToast();
  const pending = usePendingProfiles(true);
  const [target, setTarget] = React.useState<Freelancer | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [found, setFound] = React.useState<Found | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  const decide = async (f: Freelancer, decision: 'approve' | 'request_changes', n?: string) => {
    setBusy(f.id);
    try {
      await reviewProfile({ uid: f.id, decision, note: n });
      toast(decision === 'approve' ? `${f.name} is now live.` : 'Changes requested.');
      setTarget(null);
      setNote('');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setFound(null);
    try {
      setFound(await lookupUser({ email: email.trim() }));
    } catch (err) {
      setLookupError(errorMessage(err, 'No user found for that email.'));
    }
  };

  return (
    <Page title="Review queue" width="narrow">
      <PageHeader title="Review queue" description="Profiles waiting for approval, oldest first." actions={<Link to="/admin/reports" className="text-meta text-text underline underline-offset-4 rounded-sm">Reports</Link>} />

      {pending.error ? (
        <ErrorState message="We couldn't load the queue." />
      ) : pending.loading ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading queue</span><Skeleton className="h-160 w-full" /></div>
      ) : pending.data.length === 0 ? (
        <EmptyState title="Queue is empty" message="New and edited profiles will appear here." />
      ) : (
        <ul className="flex flex-col gap-12 mb-40">
          {pending.data.map((f) => (
            <li key={f.id} className="p-20 border border-border rounded-lg bg-surface">
              <div className="flex items-start justify-between gap-12 mb-8">
                <div>
                  <Link to={`/freelancer/${f.id}`} className="text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">{f.name}</Link>
                  <p className="text-meta text-text-dim">{f.headline}</p>
                </div>
                <span className="font-mono tabular-nums text-meta text-text-dim">{formatRate(f)}</span>
              </div>
              <p className="text-body text-text-dim line-clamp-3 mb-12">{f.bio}</p>
              <div className="flex flex-wrap gap-4 mb-12">{f.skills.map((s) => (<Tag key={s}>{s}</Tag>))}</div>
              {f.portfolioUrl && <a href={f.portfolioUrl} target="_blank" rel="noopener noreferrer" className="block text-meta text-accent-text underline underline-offset-4 mb-12 rounded-sm">{f.portfolioUrl}<span className="sr-only"> (opens in a new tab)</span></a>}
              <div className="flex gap-8">
                <Button loading={busy === f.id} onClick={() => decide(f, 'approve')}>Approve</Button>
                <Button variant="secondary" onClick={() => { setNote(''); setTarget(f); }}>Request changes</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="lookup-title">
        <h2 id="lookup-title" className="text-body font-semibold text-text mb-16">Look up a user</h2>
        <form onSubmit={search} className="flex gap-8 items-end max-w-form mb-16">
          <div className="flex-1"><Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div>
          <Button type="submit" variant="secondary" disabled={!email.trim()}>Look up</Button>
        </form>
        {lookupError && <p role="alert" className="text-meta text-text">{lookupError}</p>}
        {found && (
          <div role="status" className="p-16 border border-border rounded-lg bg-surface text-body">
            <p className="text-text">{found.email} <span className="text-text-dim">· {found.role ?? 'no role'}{found.disabled ? ' · suspended' : ''}</span></p>
            {found.profile && (
              <>
                <p className="text-meta text-text-dim mt-4">{found.profile.name} · {found.profile.reviewStatus}{found.profile.approved ? ' · live' : ''}</p>
                <div className="flex gap-8 mt-12">
                  <Button size="sm" variant="secondary" onClick={() => setVerified({ uid: found.uid, verified: true }).then(() => toast('Marked verified.')).catch((err) => toast(errorMessage(err)))}>Mark verified</Button>
                  <Button size="sm" variant="ghost" onClick={() => setVerified({ uid: found.uid, verified: false }).then(() => toast('Verified badge removed.')).catch((err) => toast(errorMessage(err)))}>Remove verified</Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <Dialog open={target !== null} onClose={() => setTarget(null)} title="Request changes" description={`Tell ${target?.name ?? 'them'} what to fix. They'll see this note.`}>
        <div className="flex flex-col gap-16">
          <Field label="Note" required hint={`${note.length} / 500`}><Textarea rows={4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
          <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button><Button loading={busy === target?.id} disabled={note.trim().length < 5} onClick={() => target && decide(target, 'request_changes', note.trim())}>Send</Button></div>
        </div>
      </Dialog>
    </Page>
  );
};
