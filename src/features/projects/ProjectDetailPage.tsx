import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Badge';
import { Tag } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import { openProposalThread } from '@/lib/data/messaging';
import { deleteProject, setProposalStatus, updateProject, useProject, useProposalsForProject } from '@/lib/data/projects';
import { formatMoney, formatRelative } from '@/lib/format';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const project = useProject(id ?? null);
  const proposals = useProposalsForProject(id ?? null, currentUser?.uid ?? null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const choose = async (proposalId: string) => {
    setBusy(proposalId);
    try {
      const { threadId } = await openProposalThread({ proposalId });
      navigate(`/messages/${threadId}`);
    } catch (err) {
      toast(errorMessage(err));
      setBusy(null);
    }
  };

  if (project.error) return <Page><ErrorState message="We couldn't load this project." /></Page>;
  if (project.loading) return <Page width="narrow"><div aria-busy="true"><span className="sr-only" role="status">Loading project</span><Skeleton className="h-200 w-full" /></div></Page>;
  const p = project.data;
  if (!p || p.clientUid !== currentUser?.uid) return <Page width="narrow"><EmptyState title="Project not found" message="It may have been deleted." action={<Link to="/projects" className="underline underline-offset-4 text-text">Back to projects</Link>} /></Page>;

  const sorted = [...proposals.data].sort((a, b) => a.rate - b.rate);

  return (
    <Page title={p.title} width="narrow">
      <PageHeader
        title={p.title}
        description={`${formatMoney(p.budgetMin)}–${formatMoney(p.budgetMax)}/hr${p.timeline ? ` · ${p.timeline}` : ''} · posted ${formatRelative(p.createdAt)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => updateProject(p.id, { status: p.status === 'open' ? 'closed' : 'open' }).then(() => toast(p.status === 'open' ? 'Project closed.' : 'Project reopened.'))}>{p.status === 'open' ? 'Close project' : 'Reopen'}</Button>
            <Button variant="ghost" onClick={() => deleteProject(p.id).then(() => navigate('/projects'))}>Delete</Button>
          </>
        }
      />
      <p className="text-body text-text-dim whitespace-pre-wrap max-w-prose mb-16">{p.description}</p>
      <div className="flex flex-wrap gap-8 mb-40">{p.skills.map((s) => (<Tag key={s}>{s}</Tag>))}</div>

      <h2 className="text-section-heading text-text mb-16">Proposals <span className="font-mono tabular-nums text-text-dim">({sorted.length})</span></h2>
      {proposals.error ? (
        <ErrorState message="We couldn't load proposals." />
      ) : proposals.loading ? (
        <Skeleton className="h-120 w-full" />
      ) : sorted.length === 0 ? (
        <EmptyState message="No proposals yet. Freelancers with matching skills will see this project." />
      ) : (
        <ul className="grid md:grid-cols-2 gap-12">
          {sorted.map((pr) => (
            <li key={pr.id} className="p-20 border border-border rounded-lg bg-surface flex flex-col gap-12">
              <div className="flex items-start justify-between gap-12">
                <Link to={`/freelancer/${pr.freelancerUid}`} className="text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">{pr.freelancerName ?? 'Freelancer'}</Link>
                <span className="font-mono tabular-nums text-body text-text">{formatMoney(pr.rate)}/hr</span>
              </div>
              <p className="text-body text-text-dim whitespace-pre-wrap flex-1">{pr.message}</p>
              <div className="flex items-center gap-8 flex-wrap">
                {pr.status === 'chosen' ? (
                  <Button variant="secondary" onClick={() => navigate(`/messages/${pr.threadId}`)}>Open conversation</Button>
                ) : (
                  <>
                    <Button loading={busy === pr.id} onClick={() => choose(pr.id)}>Choose and message</Button>
                    <Button variant="ghost" size="sm" onClick={() => setProposalStatus(pr.id, pr.status === 'shortlisted' ? 'sent' : 'shortlisted')}>{pr.status === 'shortlisted' ? 'Remove from shortlist' : 'Shortlist'}</Button>
                    {pr.status !== 'declined' && <Button variant="ghost" size="sm" onClick={() => setProposalStatus(pr.id, 'declined')}>Decline</Button>}
                  </>
                )}
                {pr.status !== 'sent' && <Pill>{pr.status === 'shortlisted' ? 'Shortlisted' : pr.status === 'chosen' ? 'Chosen' : 'Declined'}</Pill>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
};
