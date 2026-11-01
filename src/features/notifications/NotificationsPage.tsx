import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/lib/providers/AuthContext';
import { markAllNotificationsRead, markNotificationRead, useNotifications } from '@/lib/data/notifications';
import { formatRelative } from '@/lib/format';

export const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const uid = currentUser!.uid;
  const { data, loading, error } = useNotifications(uid);
  const unread = data.filter((n) => !n.read);

  return (
    <Page title="Notifications" width="narrow">
      <PageHeader
        title="Notifications"
        actions={unread.length > 0 ? <Button variant="secondary" onClick={() => void markAllNotificationsRead(uid, unread.map((n) => n.id))}>Mark all as read</Button> : undefined}
      />
      {error ? (
        <ErrorState message="We couldn't load your notifications." />
      ) : loading ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading notifications</span><Skeleton className="h-64 w-full mb-8" /><Skeleton className="h-64 w-full mb-8" /><Skeleton className="h-64 w-full" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="You're all caught up" message="Requests, messages and proposals will show up here." />
      ) : (
        <ul className="border border-border rounded-lg bg-surface overflow-hidden">
          {data.map((n) => (
            <li key={n.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  if (!n.read) void markNotificationRead(uid, n.id);
                  if (n.link) navigate(n.link);
                }}
                className="w-full text-left px-16 py-12 flex items-start gap-12 hover:bg-surface-2 transition-colors duration-120"
              >
                <span aria-hidden="true" className={`mt-8 w-8 h-8 rounded-full flex-shrink-0 ${n.read ? 'border border-border-strong' : 'bg-text'}`} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-body ${n.read ? 'text-text-dim' : 'text-text font-medium'}`}>{n.title}<span className="sr-only">{n.read ? '' : ' (unread)'}</span></span>
                  {n.body && <span className="block text-meta text-text-dim">{n.body}</span>}
                </span>
                <span className="text-11 text-text-dim whitespace-nowrap mt-4">{formatRelative(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
};
