import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Columns3 } from 'lucide-react';
import type { Freelancer, MatchLine } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge, Pill } from '@/components/ui/Badge';
import { Tag } from '@/components/ui/Chip';
import { StatusDot } from '@/components/ui/StatusDot';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SaveButton } from '@/components/freelancer/SaveButton';
import { availabilityLabel, formatRate, formatRating, formatResponseTime } from '@/lib/format';
import type { SortDir, SortField } from '../searchState';

const grid = 'grid grid-cols-results-md xl:grid-cols-results gap-12 items-center px-16';

interface ResultsTableProps {
  data: Freelancer[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  sortField: SortField;
  sortDirection: SortDir;
  onChangeSort: (field: SortField) => void;
  lines: Record<string, MatchLine>;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
}

const NotYet: React.FC = () => (
  <>
    <span aria-hidden="true" className="text-text-dim">–</span>
    <span className="sr-only">Not enough replies yet</span>
  </>
);

const CompareToggle: React.FC<{ f: Freelancer; on: boolean; disabled: boolean; onToggle: () => void }> = ({ f, on, disabled, onToggle }) => (
  <button
    type="button"
    aria-pressed={on}
    aria-label={`Compare ${f.name}`}
    title={disabled && !on ? 'You can compare up to 3 freelancers' : on ? 'Remove from compare' : 'Add to compare'}
    disabled={disabled && !on}
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className={`relative z-10 inline-flex items-center justify-center w-32 h-32 rounded-md transition duration-120 active:scale-97 hover:bg-surface-3 disabled:opacity-50 ${on ? 'text-text bg-surface-3' : 'text-text-dim hover:text-text'}`}
  >
    {on ? <Check className="w-16 h-16" aria-hidden="true" /> : <Columns3 className="w-16 h-16" aria-hidden="true" />}
  </button>
);

export const ResultsTable: React.FC<ResultsTableProps> = ({
  data, isLoading, isError, onRetry, onClearFilters, sortField, sortDirection, onChangeSort, lines, compareIds, onToggleCompare,
}) => {
  const compareFull = compareIds.length >= 3;

  const SortHeader: React.FC<{ field: SortField; label: string; align?: 'right' | 'left'; hideBelowXl?: boolean }> = ({ field, label, align = 'left', hideBelowXl }) => {
    const active = sortField === field;
    return (
      <div
        role="columnheader"
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`${hideBelowXl ? 'hidden xl:block' : ''} ${align === 'right' ? 'text-right' : ''}`}
      >
        <button
          type="button"
          onClick={() => onChangeSort(field)}
          className={`inline-flex items-center gap-4 rounded-sm hover:text-text ${active ? 'text-text' : 'text-text-dim'}`}
        >
          {label}
          {active && (sortDirection === 'asc' ? <ArrowUp className="w-12 h-12" aria-hidden="true" /> : <ArrowDown className="w-12 h-12" aria-hidden="true" />)}
        </button>
      </div>
    );
  };

  const body = () => {
    if (isError) return <ErrorState className="py-64" message="We couldn't load freelancers. Please try again." onRetry={onRetry} />;

    if (isLoading) {
      return (
        <div aria-busy="true">
          <span className="sr-only" role="status">Loading results</span>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${grid} py-12 border-b border-border last:border-b-0`} aria-hidden="true">
              <div className="flex items-center gap-12"><Skeleton className="w-24 h-24 rounded-full" /><div className="flex-1 flex flex-col gap-4"><Skeleton className="h-16 w-3/4" /><Skeleton className="h-12 w-1/2" /></div></div>
              <div className="flex flex-col gap-4"><div className="flex gap-4"><Skeleton className="h-20 w-48" /><Skeleton className="h-20 w-48" /></div><Skeleton className="h-12 w-3/4" /></div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="hidden xl:block h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <EmptyState
          className="py-64"
          title="No freelancers match"
          message="Try widening the rate range or removing a skill."
          actionLabel="Clear all filters"
          onAction={onClearFilters}
        />
      );
    }

    return data.map((f) => {
      const line = lines[f.id];
      const rating = formatRating(f.ratingAvg);
      const response = formatResponseTime(f.avgResponseMinutes);
      return (
        <div
          key={f.id}
          role="row"
          data-row-id={f.id}
          className={`${grid} relative py-12 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors duration-120`}
        >
          <div role="cell" className="flex items-center gap-12 min-w-0">
            <Avatar src={f.avatarUrl} name={f.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-8 min-w-0">
                <Link
                  to={`/freelancer/${f.id}`}
                  data-row-link
                  className="text-body font-medium text-text truncate rounded-sm after:absolute after:inset-0 after:content-['']"
                >
                  {f.name}
                </Link>
                {f.verified && <VerifiedBadge className="flex-shrink-0" />}
              </div>
              <p className="text-meta text-text-dim truncate">{f.headline}</p>
            </div>
          </div>

          <div role="cell" className="min-w-0 flex flex-col gap-4">
            <div className="flex items-center gap-4 overflow-hidden">
              {f.skills.slice(0, 3).map((s) => (<Tag key={s}>{s}</Tag>))}
              {f.skills.length > 3 && <span className="text-11 text-text-dim whitespace-nowrap">+{f.skills.length - 3}</span>}
            </div>
            {line && <p className="text-meta text-text-dim truncate" title={line.reasoning}>{line.reasoning}</p>}
          </div>

          <div role="cell" className="text-right font-mono tabular-nums text-body text-text whitespace-nowrap">{formatRate(f)}</div>

          <div role="cell" className="text-right font-mono tabular-nums text-body text-text">
            {rating ?? <Pill>New</Pill>}
          </div>

          <div role="cell" className="hidden xl:block text-right font-mono tabular-nums text-body text-text-dim">
            {response ?? <NotYet />}
          </div>

          <div role="cell" className="flex items-center gap-8 min-w-0">
            <StatusDot status={f.availability} />
            <span className="text-body text-text-dim truncate">{availabilityLabel(f.availability)}</span>
          </div>

          <div role="cell" className="flex items-center justify-end gap-4">
            <CompareToggle f={f} on={compareIds.includes(f.id)} disabled={compareFull} onToggle={() => onToggleCompare(f.id)} />
            <SaveButton id={f.id} name={f.name} />
          </div>
        </div>
      );
    });
  };

  return (
    <div role="table" aria-label="Freelancers" aria-rowcount={isLoading || isError ? undefined : data.length + 1} className="border border-border rounded-lg bg-surface overflow-hidden">
      <div role="row" className={`${grid} py-12 border-b border-border text-meta font-medium`}>
        <div role="columnheader" className="text-text-dim">Freelancer</div>
        <div role="columnheader" className="text-text-dim">Skills</div>
        <SortHeader field="rate" label="Rate" align="right" />
        <SortHeader field="rating" label="Rating" align="right" />
        <SortHeader field="response_time" label="Response" align="right" hideBelowXl />
        <div role="columnheader" className="text-text-dim">Availability</div>
        <div role="columnheader" className="text-right text-text-dim"><span className="sr-only">Actions</span></div>
      </div>
      <div role="rowgroup">{body()}</div>
    </div>
  );
};
