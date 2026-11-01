import React from 'react';
import { Link } from 'react-router-dom';
import { usePrefetch } from '@/hooks/usePrefetch';
import { Check, Columns3 } from 'lucide-react';
import type { Freelancer, MatchLine } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge, Pill } from '@/components/ui/Badge';
import { Tag } from '@/components/ui/Chip';
import { StatusDot } from '@/components/ui/StatusDot';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SaveButton } from '@/components/freelancer/SaveButton';
import { availabilityLabel, formatRate, formatRating, formatResponseTime } from '@/lib/format';

interface ResultCardsProps {
  data: Freelancer[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  lines: Record<string, MatchLine>;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
}

/** Small-screen layout: one card per freelancer instead of a table that scrolls sideways. */
export const ResultCards: React.FC<ResultCardsProps> = ({ data, isLoading, isError, onRetry, onClearFilters, lines, compareIds, onToggleCompare }) => {
  const prefetch = usePrefetch();
  if (isError) return <ErrorState className="py-48" message="We couldn't load freelancers. Please try again." onRetry={onRetry} />;

  if (isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-12">
        <span className="sr-only" role="status">Loading results</span>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} aria-hidden="true" className="border border-border rounded-lg bg-surface p-16 flex flex-col gap-12">
            <div className="flex items-center gap-12"><Skeleton className="w-32 h-32 rounded-full" /><div className="flex-1 flex flex-col gap-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-12 w-3/4" /></div></div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState className="py-48" title="No freelancers match" message="Try widening the rate range or removing a skill." actionLabel="Clear all filters" onAction={onClearFilters} />;
  }

  return (
    <ul aria-label="Freelancers" className="flex flex-col gap-12">
      {data.map((f) => {
        const line = lines[f.id];
        const rating = formatRating(f.ratingAvg);
        const response = formatResponseTime(f.avgResponseMinutes);
        const comparing = compareIds.includes(f.id);
        return (
          <li key={f.id} data-row-id={f.id} className="relative border border-border rounded-lg bg-surface p-16 flex flex-col gap-12 hover:bg-surface-2 transition-colors duration-120">
            <div className="flex items-start gap-12">
              <Avatar src={f.avatarUrl} name={f.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-8 flex-wrap">
                  <Link to={`/freelancer/${f.id}`} data-row-link onPointerDown={() => prefetch(`/freelancer/${f.id}`)} onFocus={() => prefetch(`/freelancer/${f.id}`)} className="text-body font-medium text-text rounded-sm after:absolute after:inset-0 after:content-['']">
                    {f.name}
                  </Link>
                  {f.verified && <VerifiedBadge compact />}
                </div>
                <p className="text-meta text-text-dim">{f.headline}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <button
                  type="button"
                  aria-pressed={comparing}
                  aria-label={`Compare ${f.name}`}
                  disabled={!comparing && compareIds.length >= 3}
                  onClick={() => onToggleCompare(f.id)}
                  className={`relative z-10 inline-flex items-center justify-center w-44 h-44 rounded-md hover:bg-surface-3 disabled:opacity-50 ${comparing ? 'text-text bg-surface-3' : 'text-text-dim'}`}
                >
                  {comparing ? <Check className="w-16 h-16" aria-hidden="true" /> : <Columns3 className="w-16 h-16" aria-hidden="true" />}
                </button>
                <SaveButton id={f.id} name={f.name} variant="framed" />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">{f.skills.slice(0, 5).map((s) => (<Tag key={s}>{s}</Tag>))}</div>
            {line && <p className="text-meta text-text-dim">{line.reasoning}</p>}

            <dl className="grid grid-cols-3 gap-12 text-meta">
              <div><dt className="text-text-dim">Rate</dt><dd className="font-mono tabular-nums text-text">{formatRate(f)}</dd></div>
              <div><dt className="text-text-dim">Rating</dt><dd className="font-mono tabular-nums text-text">{rating ?? <Pill>New</Pill>}</dd></div>
              <div><dt className="text-text-dim">Response</dt><dd className="font-mono tabular-nums text-text">{response ?? '–'}</dd></div>
            </dl>
            <div className="flex items-center gap-8 text-meta text-text-dim"><StatusDot status={f.availability} />{availabilityLabel(f.availability)}</div>
          </li>
        );
      })}
    </ul>
  );
};
