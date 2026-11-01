import React from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/lib/providers/AuthContext';
import { useProfileStats } from '@/lib/data/profile';
import type { DayStat } from '@/types';

type Metric = 'views' | 'shortlistAdds' | 'requests';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'views', label: 'Profile views' },
  { key: 'shortlistAdds', label: 'Shortlist adds' },
  { key: 'requests', label: 'Requests received' },
];

/** Sums stats into four consecutive 7-day buckets, oldest first. */
function weekly(days: DayStat[], key: Metric, now = new Date()): number[] {
  const buckets = [0, 0, 0, 0];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  days.forEach((d) => {
    const age = Math.floor((today - Date.parse(`${d.day}T00:00:00Z`)) / 86400000);
    if (age >= 0 && age < 28) buckets[3 - Math.floor(age / 7)] += d[key];
  });
  return buckets;
}

const Bars: React.FC<{ label: string; values: number[] }> = ({ label, values }) => {
  const max = Math.max(1, ...values);
  const names = ['3 weeks ago', '2 weeks ago', 'Last week', 'This week'];
  return (
    <div>
      <div role="img" aria-label={`${label} by week: ${values.map((v, i) => `${names[i]} ${v}`).join(', ')}`} className="flex items-end gap-8 h-96">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end h-full">
            <div className={`w-full rounded-sm ${i === 3 ? 'bg-text' : 'bg-border-strong'}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-8 mt-8" aria-hidden="true">
        {values.map((v, i) => (<span key={i} className="flex-1 text-center font-mono tabular-nums text-11 text-text-dim">{v}</span>))}
      </div>
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { data, loading, error } = useProfileStats(currentUser?.uid ?? null);

  return (
    <Page title="Analytics" width="narrow">
      <PageHeader title="Analytics" description="How clients are finding you, week by week over the last four weeks." />
      {error ? (
        <ErrorState message="We couldn't load your analytics." />
      ) : loading ? (
        <div aria-busy="true"><span className="sr-only" role="status">Loading analytics</span><Skeleton className="h-200 w-full" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Nothing to show yet" message="Once your profile is live and clients start visiting, you'll see views, shortlist adds and requests here." />
      ) : (
        <div className="grid sm:grid-cols-3 gap-16">
          {METRICS.map((m) => {
            const values = weekly(data, m.key);
            const delta = values[3] - values[2];
            return (
              <section key={m.key} aria-label={m.label} className="p-20 border border-border rounded-lg bg-surface">
                <h2 className="text-meta text-text-dim mb-4">{m.label}</h2>
                <p className="font-mono tabular-nums text-section-heading text-text mb-4">{values[3]}</p>
                <p className="text-meta text-text-dim mb-16">{delta === 0 ? 'Same as last week' : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} from last week`}</p>
                <Bars label={m.label} values={values} />
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
};
