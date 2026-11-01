import React from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/data/api';
import { resolveReport, useOpenReports } from '@/lib/data/profile';
import { formatRelative } from '@/lib/format';

export const AdminReportsPage: React.FC = () => {
  const { toast } = useToast();
  const { data, loading, error } = useOpenReports(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const resolve = async (id: string, suspend: boolean) => {
    setBusy(id);
    try {
      await resolveReport({ reportId: id, suspend });
      toast(suspend ? 'Resolved and account suspended.' : 'Resolved.');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title="Reports" width="narrow">
      <PageHeader title="Reports" actions={<Link to="/admin" className="text-meta text-text underline underline-offset-4 rounded-sm">Review queue</Link>} />
      {error ? (
        <ErrorState message="We couldn't load reports." />
      ) : loading ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading reports</span><Skeleton className="h-96 w-full" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="No open reports" message="Nothing needs attention." />
      ) : (
        <ul className="flex flex-col gap-12">
          {data.map((r) => (
            <li key={r.id} className="p-20 border border-border rounded-lg bg-surface">
              <div className="flex justify-between gap-12 mb-8">
                <p className="text-body font-medium text-text">{r.targetType === 'profile' ? <Link to={`/freelancer/${r.targetId}`} className="hover:underline underline-offset-4">Profile {r.targetId}</Link> : `Conversation ${r.targetId}`}</p>
                <span className="text-meta text-text-dim">{formatRelative(r.createdAt)}</span>
              </div>
              <p className="text-body text-text-dim whitespace-pre-wrap mb-16">{r.reason}</p>
              <div className="flex gap-8">
                <Button variant="secondary" loading={busy === r.id} onClick={() => resolve(r.id, false)}>Resolve</Button>
                {r.targetType === 'profile' && <Button variant="ghost" disabled={busy === r.id} onClick={() => resolve(r.id, true)}>Resolve and suspend</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
};
