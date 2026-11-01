import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Page, PageHeader } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusDot } from '@/components/ui/StatusDot';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SaveButton } from '@/components/freelancer/SaveButton';
import { getProvider } from '@/lib/providers';
import { availabilityLabel, formatRate, formatRating, formatResponseTime } from '@/lib/format';
import type { Freelancer } from '@/types';

const Row: React.FC<{ label: string; cells: React.ReactNode[] }> = ({ label, cells }) => (
  <tr className="border-b border-border last:border-b-0 align-top">
    <th scope="row" className="py-16 pr-16 text-left text-meta font-medium text-text-dim w-160">{label}</th>
    {cells.map((c, i) => (<td key={i} className="py-16 px-12 text-body text-text">{c}</td>))}
  </tr>
);

export const ComparePage: React.FC = () => {
  const [params] = useSearchParams();
  const provider = React.useMemo(() => getProvider(), []);
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['compare', ids.join(',')],
    queryFn: () => provider.getByIds(ids),
    enabled: ids.length >= 2,
  });
  const people = (data ?? []).filter((f): f is Freelancer => Boolean(f));

  if (ids.length < 2) {
    return (
      <Page title="Compare">
        <PageHeader title="Compare" />
        <EmptyState title="Pick two or three freelancers" message="Use the compare button on search results or in a shortlist." action={<ButtonLink to="/">Find freelancers</ButtonLink>} />
      </Page>
    );
  }
  if (isError) return <Page title="Compare"><ErrorState message="We couldn't load this comparison." onRetry={() => refetch()} /></Page>;
  if (isLoading) return <Page title="Compare"><div aria-busy="true"><span className="sr-only" role="status">Loading comparison</span><Skeleton className="h-200 w-full" /></div></Page>;
  if (people.length < 2) return <Page title="Compare"><EmptyState message="Some of these profiles are no longer available." action={<ButtonLink to="/">Back to search</ButtonLink>} /></Page>;

  // Skills everyone shares are dimmed so the differences stand out.
  const counts = new Map<string, number>();
  people.forEach((p) => p.skills.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1)));

  return (
    <Page title="Compare" width="page">
      <PageHeader title="Compare" description="Side by side on the things that usually decide it." />
      <div className="overflow-x-auto border border-border rounded-lg bg-surface">
        <table className="w-full min-w-640 border-collapse">
          <caption className="sr-only">Comparison of {people.map((p) => p.name).join(', ')}</caption>
          <thead>
            <tr className="border-b border-border align-top">
              <td className="w-160" />
              {people.map((p) => (
                <th key={p.id} scope="col" className="p-16 text-left font-normal">
                  <div className="flex items-start gap-12">
                    <Avatar src={p.avatarUrl} name={p.name} size="lg" />
                    <div className="min-w-0">
                      <Link to={`/freelancer/${p.id}`} className="text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">{p.name}</Link>
                      {p.verified && <div className="mt-4"><VerifiedBadge /></div>}
                      <p className="text-meta text-text-dim mt-4">{p.headline}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="px-16">
            <Row label="Rate" cells={people.map((p) => <span key={p.id} className="font-mono tabular-nums">{formatRate(p)}</span>)} />
            <Row label="Rating" cells={people.map((p) => <span key={p.id} className="font-mono tabular-nums">{formatRating(p.ratingAvg) ?? 'New'}{p.reviewCount ? ` (${p.reviewCount})` : ''}</span>)} />
            <Row label="Response time" cells={people.map((p) => <span key={p.id} className="font-mono tabular-nums">{formatResponseTime(p.avgResponseMinutes) ?? '–'}</span>)} />
            <Row label="Availability" cells={people.map((p) => <span key={p.id} className="flex items-center gap-8"><StatusDot status={p.availability} />{availabilityLabel(p.availability)}</span>)} />
            <Row label="Skills" cells={people.map((p) => (
              <ul key={p.id} className="flex flex-wrap gap-4">
                {p.skills.map((s) => (
                  <li key={s} className={`text-11 px-8 py-4 rounded-sm border ${(counts.get(s) ?? 0) > 1 ? 'border-border text-text-dim' : 'border-border-strong text-text bg-surface-3'}`}>{s}</li>
                ))}
              </ul>
            ))} />
            <Row label="Languages" cells={people.map((p) => (p.languages?.length ? p.languages.join(', ') : '–'))} />
            <Row label="Time zone" cells={people.map((p) => p.timezone.replace('_', ' '))} />
            <Row label="" cells={people.map((p) => (
              <div key={p.id} className="flex items-center gap-8">
                <ButtonLink to={`/freelancer/${p.id}`} size="sm">View profile</ButtonLink>
                <SaveButton id={p.id} name={p.name} variant="framed" />
              </div>
            ))} />
          </tbody>
        </table>
      </div>
    </Page>
  );
};
