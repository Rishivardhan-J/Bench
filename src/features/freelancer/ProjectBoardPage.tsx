import React from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Textarea } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Tag } from '@/components/ui/Chip';
import { Pill } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import { useOwnProfile } from '@/lib/data/profile';
import { submitProposal, useMyProposals, useOpenProjects, withdrawProposal } from '@/lib/data/projects';
import { formatMoney, formatRelative } from '@/lib/format';
import type { Project } from '@/types';

export const ProjectBoardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const uid = currentUser?.uid ?? null;
  const own = useOwnProfile(uid);
  const projects = useOpenProjects(true);
  const proposals = useMyProposals(uid);
  const [matchingOnly, setMatchingOnly] = React.useState(true);
  const [target, setTarget] = React.useState<Project | null>(null);
  const [message, setMessage] = React.useState('');
  const [rate, setRate] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const mySkills = new Set((own.data?.skills ?? []).map((s) => s.toLowerCase()));
  const live = own.data?.approved === true;
  const sent = new Map(proposals.data.map((p) => [p.projectId, p]));
  const shown = projects.data.filter((p) => !matchingOnly || p.skills.some((s) => mySkills.has(s.toLowerCase())));

  const open = (p: Project) => {
    setTarget(p);
    setMessage('');
    setRate(own.data?.rateMin ? String(own.data.rateMin) : '');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || !uid || !own.data) return;
    const rateNum = Number(rate);
    if (!rateNum || rateNum <= 0) return setError('Enter your hourly rate for this project.');
    if (message.trim().length < 10) return setError('Write a short note about why you are a fit.');
    setBusy(true);
    setError(null);
    try {
      await submitProposal({ project: target, freelancerUid: uid, freelancerName: own.data.name, message: message.trim(), rate: rateNum });
      toast('Proposal sent.');
      setTarget(null);
    } catch (err) {
      setError(errorMessage(err, "We couldn't send that proposal. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Project board" width="narrow">
      <PageHeader title="Project board" description="Open projects from clients. Send a short proposal to the ones that fit." />

      {!live && !own.loading && (
        <div role="status" className="mb-24 p-12 rounded-md border border-border-strong bg-surface-2 text-body text-text-dim">
          Your profile needs to be live before you can send proposals.
        </div>
      )}

      <div className="mb-24"><Checkbox label="Only projects that match my skills" checked={matchingOnly} onChange={(e) => setMatchingOnly(e.target.checked)} /></div>

      {projects.error ? (
        <ErrorState message="We couldn't load projects." />
      ) : projects.loading ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading projects</span><Skeleton className="h-160 w-full mb-12" /><Skeleton className="h-160 w-full" /></div>
      ) : shown.length === 0 ? (
        <EmptyState message={matchingOnly ? 'No open projects match your skills right now. Turn off the filter to see all projects.' : 'No open projects yet.'} />
      ) : (
        <ul className="flex flex-col gap-12">
          {shown.map((p) => {
            const proposal = sent.get(p.id);
            return (
              <li key={p.id} className="p-20 border border-border rounded-lg bg-surface">
                <div className="flex items-start justify-between gap-12 mb-8">
                  <h2 className="text-body font-semibold text-text">{p.title}</h2>
                  <span className="text-meta text-text-dim whitespace-nowrap">{formatRelative(p.createdAt)}</span>
                </div>
                <p className="text-meta text-text-dim mb-12">
                  {p.clientName ?? 'A client'} · <span className="font-mono tabular-nums">{formatMoney(p.budgetMin)}–{formatMoney(p.budgetMax)}/hr</span>{p.timeline ? ` · ${p.timeline}` : ''}
                </p>
                <p className="text-body text-text-dim mb-12 line-clamp-3 whitespace-pre-wrap">{p.description}</p>
                <div className="flex flex-wrap gap-4 mb-16">{p.skills.map((s) => (<Tag key={s}>{s}</Tag>))}</div>
                {proposal ? (
                  <div className="flex items-center gap-12">
                    <Pill>{proposal.status === 'sent' ? 'Proposal sent' : proposal.status === 'chosen' ? 'Chosen' : proposal.status === 'shortlisted' ? 'Shortlisted' : 'Declined'}</Pill>
                    {proposal.status === 'chosen' && proposal.threadId && <a className="text-meta text-text underline underline-offset-4" href={`/messages/${proposal.threadId}`}>Open conversation</a>}
                    {proposal.status === 'sent' && <Button variant="ghost" size="sm" onClick={() => withdrawProposal(proposal.id).then(() => toast('Proposal withdrawn.'))}>Withdraw</Button>}
                  </div>
                ) : (
                  <Button onClick={() => open(p)} disabled={!live}>Send proposal</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={target !== null} onClose={() => setTarget(null)} title="Send a proposal" description={target?.title}>
        <form onSubmit={submit} className="flex flex-col gap-16" noValidate>
          {error && <div role="alert" className="p-12 bg-surface-2 border border-border-strong text-meta text-text rounded-sm">{error}</div>}
          <Field label="Your hourly rate (USD)" required><Input type="number" min={1} inputMode="numeric" className="font-mono" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
          <Field label="Why you are a fit" required hint={`${message.length} / 2000`}><Textarea rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus /></Field>
          <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button><Button type="submit" loading={busy}>Send proposal</Button></div>
        </form>
      </Dialog>
    </Page>
  );
};
