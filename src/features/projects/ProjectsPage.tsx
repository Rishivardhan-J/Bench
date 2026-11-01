import React from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { ButtonLink } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/lib/providers/AuthContext';
import { useMyProjects } from '@/lib/data/projects';
import { formatMoney, formatRelative } from '@/lib/format';

export const ProjectsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { data, loading, error } = useMyProjects(currentUser!.uid);

  return (
    <Page title="Projects" width="narrow">
      <PageHeader title="Projects" description="Post a project and compare proposals from matching freelancers." actions={<ButtonLink to="/projects/new">New project</ButtonLink>} />
      {error ? (
        <ErrorState message="We couldn't load your projects." />
      ) : loading ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading projects</span><Skeleton className="h-96 w-full mb-12" /><Skeleton className="h-96 w-full" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="No projects yet" message="Describe what you need and freelancers can send you proposals." action={<ButtonLink to="/projects/new">Post a project</ButtonLink>} />
      ) : (
        <ul className="flex flex-col gap-12">
          {data.map((p) => (
            <li key={p.id} className="p-20 border border-border rounded-lg bg-surface">
              <div className="flex items-start justify-between gap-12">
                <Link to={`/projects/${p.id}`} className="text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">{p.title}</Link>
                <Pill>{p.status === 'open' ? 'Open' : 'Closed'}</Pill>
              </div>
              <p className="text-meta text-text-dim mt-4 font-mono tabular-nums">{formatMoney(p.budgetMin)}–{formatMoney(p.budgetMax)}/hr · <span className="font-sans">posted {formatRelative(p.createdAt)}</span></p>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
};
