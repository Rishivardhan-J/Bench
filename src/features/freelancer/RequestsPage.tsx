import React from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import { respondToConnection, useIncomingConnections } from '@/lib/data/messaging';
import { formatRelative } from '@/lib/format';
import type { Connection } from '@/types';

type Tab = 'pending' | 'accepted' | 'declined' | 'blocked';

export const RequestsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { data, loading, error } = useIncomingConnections(currentUser?.uid ?? null);
  const [tab, setTab] = React.useState<Tab>('pending');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = React.useState<Connection | null>(null);

  const counts = (s: Tab) => data.filter((c) => c.status === s).length;
  const rows = data.filter((c) => c.status === tab);

  const act = async (c: Connection, action: 'accept' | 'decline' | 'block') => {
    setBusyId(c.id);
    try {
      await respondToConnection({ connectionId: c.id, action });
      toast(action === 'accept' ? 'Accepted. You can message them now.' : action === 'decline' ? 'Declined.' : 'Blocked. They can no longer contact you.');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusyId(null);
      setConfirmBlock(null);
    }
  };

  return (
    <Page title="Requests" width="narrow">
      <PageHeader title="Requests" description="You decide who can message you. Accepting opens a private conversation." />
      <Tabs
        label="Request status"
        value={tab}
        onChange={(t) => setTab(t as Tab)}
        className="mb-24"
        tabs={[
          { id: 'pending', label: 'Pending', count: counts('pending') },
          { id: 'accepted', label: 'Accepted', count: counts('accepted') },
          { id: 'declined', label: 'Declined', count: counts('declined') },
          { id: 'blocked', label: 'Blocked', count: counts('blocked') },
        ]}
      />

      <div role="tabpanel" aria-label={`${tab} requests`}>
        {error ? (
          <ErrorState message="We couldn't load your requests." />
        ) : loading ? (
          <div aria-busy="true"><span className="sr-only" role="status">Loading requests</span><Skeleton className="h-120 w-full mb-12" /><Skeleton className="h-120 w-full" /></div>
        ) : rows.length === 0 ? (
          <EmptyState message={tab === 'pending' ? 'No pending requests. When a client connects with you, it shows up here.' : `Nothing in ${tab}.`} />
        ) : (
          <ul className="flex flex-col gap-12">
            {rows.map((c) => (
              <li key={c.id} className="p-20 border border-border rounded-lg bg-surface">
                <div className="flex items-start justify-between gap-12 mb-8">
                  <div>
                    <p className="text-body font-medium text-text">{c.clientName ?? 'A client'}</p>
                    {c.projectTitle && (
                      <p className="text-meta text-text-dim">About: <Link to="/freelancer/board" className="underline underline-offset-4">{c.projectTitle}</Link></p>
                    )}
                  </div>
                  <span className="text-meta text-text-dim whitespace-nowrap">{formatRelative(c.createdAt)}</span>
                </div>
                <p className="text-body text-text-dim whitespace-pre-wrap mb-16">{c.firstMessage}</p>

                {tab === 'pending' && (
                  <div className="flex flex-wrap gap-8">
                    <Button onClick={() => act(c, 'accept')} loading={busyId === c.id}>Accept</Button>
                    <Button variant="secondary" onClick={() => act(c, 'decline')} disabled={busyId === c.id}>Decline</Button>
                    <Button variant="ghost" onClick={() => setConfirmBlock(c)} disabled={busyId === c.id}>Block</Button>
                  </div>
                )}
                {tab === 'accepted' && <ButtonLink to={`/messages/${c.threadId ?? c.id}`} variant="secondary">Open conversation</ButtonLink>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={confirmBlock !== null} onClose={() => setConfirmBlock(null)} title={`Block ${confirmBlock?.clientName ?? 'this client'}?`} description="They won't be able to send you requests or messages. Existing conversations with them are closed.">
        <div className="flex justify-end gap-8">
          <Button variant="ghost" onClick={() => setConfirmBlock(null)}>Cancel</Button>
          <Button onClick={() => confirmBlock && act(confirmBlock, 'block')}>Block</Button>
        </div>
      </Dialog>
    </Page>
  );
};
