import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Page, PageHeader } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusDot } from '@/components/ui/StatusDot';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { api, ApiRequestError } from '@/lib/data/api';
import { toFreelancer } from '@/lib/providers/api-freelancer-provider';
import { availabilityLabel, formatRate, formatRating } from '@/lib/format';
import type { Freelancer } from '@/types';

/** A read-only view of someone's shortlist, reachable by link without an account. Private notes never leave the owner's page. */
export const SharedShortlistPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['shared-shortlist', token],
    queryFn: async () => {
      const res = await api.get<{ name: string; freelancers: Freelancer[] }>(`/shared/${encodeURIComponent(token!)}`);
      return { name: res.name, freelancers: res.freelancers.map((f) => toFreelancer(f.id, f as unknown as Record<string, unknown>)) };
    },
    enabled: Boolean(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <Page title="Shortlist" width="narrow">
        <div aria-busy="true"><span className="sr-only" role="status">Loading shortlist</span><Skeleton className="h-32 w-200 mb-32" /><Skeleton className="h-96 w-full mb-12" /><Skeleton className="h-96 w-full" /></div>
      </Page>
    );
  }

  if (error) {
    const gone = error instanceof ApiRequestError && error.code === 'not-found';
    return (
      <Page title="Shortlist" width="narrow">
        {gone ? (
          <EmptyState title="This link is no longer available" message="The person who shared it may have stopped sharing this list." action={<ButtonLink to="/" variant="secondary">Find freelancers</ButtonLink>} />
        ) : (
          <ErrorState message="We couldn't load this shortlist." onRetry={() => refetch()} />
        )}
      </Page>
    );
  }

  const list = data!;
  const ids = list.freelancers.map((f) => f.id);
  return (
    <Page title={list.name} width="narrow">
      <PageHeader
        title={list.name}
        description="A shortlist shared with you on Bench. It's read-only."
        actions={ids.length >= 2 ? <ButtonLink to={`/compare?ids=${ids.slice(0, 3).join(',')}`} variant="secondary">Compare {Math.min(3, ids.length)}</ButtonLink> : undefined}
      />
      {list.freelancers.length === 0 ? (
        <EmptyState message="Nobody on this list is available right now." />
      ) : (
        <ul className="flex flex-col gap-12">
          {list.freelancers.map((f) => (
            <li key={f.id} className="border border-border rounded-lg bg-surface p-16 flex items-start gap-12">
              <Avatar src={f.avatarUrl} name={f.name} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-8 flex-wrap">
                  <Link to={`/freelancer/${f.id}`} className="text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">{f.name}</Link>
                  {f.verified && <VerifiedBadge />}
                </div>
                <p className="text-meta text-text-dim">{f.headline}</p>
                <p className="text-meta text-text-dim font-mono tabular-nums mt-8">{formatRate(f)} · {formatRating(f.ratingAvg) ?? 'New'}</p>
                <p className="flex items-center gap-8 text-meta text-text-dim mt-4"><StatusDot status={f.availability} />{availabilityLabel(f.availability)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
};
