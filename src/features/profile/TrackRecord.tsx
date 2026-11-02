import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrackRecord } from '@/lib/data/profile';
import { formatResponseTime } from '@/lib/format';

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-8">
    <dt className="text-meta text-text-dim">{label}</dt>
    <dd className="text-body text-text font-mono tabular-nums">{children}</dd>
  </div>
);

/**
 * Earned numbers from real requests and hires: nothing here can be edited by the freelancer.
 * Hidden until there is enough history, the same rule as response time.
 */
export const TrackRecord: React.FC<{ freelancerId: string }> = ({ freelancerId }) => {
  const { data } = useQuery({
    queryKey: ['track-record', freelancerId],
    queryFn: () => getTrackRecord(freelancerId),
    staleTime: 60_000,
    retry: false,
  });
  if (!data?.visible) return null;

  const reply = formatResponseTime(data.typicalReplyMinutes ?? undefined);
  return (
    <section className="mb-40" aria-labelledby="track-record-title">
      <h2 id="track-record-title" className="text-body font-semibold text-text mb-16">Track record</h2>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-24 p-24 bg-surface rounded-lg border border-border">
        <Stat label="Requests answered">{data.answered} of {data.requests}</Stat>
        <Stat label="Typical first reply">{reply ?? <span className="font-sans text-text-dim">Not enough replies yet</span>}</Stat>
        <Stat label="Hires">{data.hires}</Stat>
        <Stat label="Repeat clients">{data.repeatClients}</Stat>
      </dl>
      <p className="text-meta text-text-dim mt-8">Counted from real requests and hires on Bench.</p>
    </section>
  );
};
