import React from 'react';
import type { Freelancer, ShortlistReasoning } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { StatusDot } from '@/components/ui/StatusDot';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Bookmark, ArrowUp, ArrowDown } from 'lucide-react';
import { useShortlist } from '@/lib/providers/ShortlistContext';
import { useNavigate } from 'react-router-dom';

const tableGrid = "grid grid-cols-[minmax(160px,2fr)_minmax(100px,1fr)_80px_60px_120px_40px] md:grid-cols-[minmax(200px,2fr)_140px_minmax(120px,1fr)_100px_80px_140px_48px] lg:grid-cols-[minmax(200px,2fr)_140px_minmax(120px,1fr)_100px_80px_100px_140px_48px] gap-16 items-center px-16 py-12";

export interface SortOption {
  field: 'relevance' | 'rate' | 'rating' | 'response_time';
}

interface ResultsTableProps {
  data: Freelancer[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onClearFilters: () => void;
  sortField: SortOption['field'];
  sortDirection: 'asc' | 'desc';
  onChangeSort: (field: SortOption['field']) => void;
  reasoningData: Record<string, ShortlistReasoning>;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
  data, isLoading, isError, onRetry, onClearFilters, sortField, sortDirection, onChangeSort, reasoningData
}) => {
  const { shortlisted, toggleShortlist } = useShortlist();
  const navigate = useNavigate();

  const handleToggleShortlist = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleShortlist(id);
  };

  const handleRowClick = (id: string) => {
    navigate(`/freelancer/${id}`);
  };

  const renderSortHeader = (field: SortOption['field'], label: string) => {
    const isActive = sortField === field;
    const isDisabled = field === 'relevance' && Object.keys(reasoningData).length === 0;

    if (isDisabled) {
      return (
        <div className="flex items-center gap-4 text-text-mute cursor-not-allowed group relative">
          <span>{label}</span>
          <div className="absolute bottom-full mb-8 hidden group-hover:block w-[200px] p-8 bg-surface-3 border border-border rounded-sm text-micro-label text-text-dim normal-case tracking-normal">
            Available after generating a shortlist.
          </div>
        </div>
      );
    }

    return (
      <button 
        onClick={() => onChangeSort(field)}
        className={`flex items-center gap-4 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm ${isActive ? 'text-text' : 'text-text-dim'}`}
        aria-label={isActive ? `Sort by ${label} ${sortDirection === 'asc' ? 'descending' : 'ascending'}` : `Sort by ${label}`}
      >
        {label}
        {isActive && (
          sortDirection === 'asc' ? <ArrowUp className="w-12 h-12" /> : <ArrowDown className="w-12 h-12" />
        )}
      </button>
    );
  };

  const renderContent = () => {
    if (isError) {
      return (
        <div className="py-64" aria-live="polite">
          <ErrorState message="Failed to load freelancers. Please try again." onRetry={onRetry} />
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="w-full" aria-live="polite">
          <div className="sr-only">Loading results...</div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`border-b border-border bg-surface ${tableGrid}`} aria-hidden="true">
              <div className="flex items-center gap-12">
                <Skeleton className="w-24 h-24 rounded-full" />
                <Skeleton className="h-16 w-3/4" />
              </div>
              <Skeleton className="hidden md:block h-16 w-full" />
              <div className="flex gap-4"><Skeleton className="h-20 w-16" /><Skeleton className="h-20 w-24" /></div>
              <Skeleton className="h-16 w-full justify-self-end" />
              <Skeleton className="h-16 w-full justify-self-end" />
              <Skeleton className="hidden lg:block h-16 w-full justify-self-end" />
              <div className="flex items-center gap-8"><Skeleton className="w-8 h-8 rounded-full" /><Skeleton className="h-16 w-24" /></div>
              <Skeleton className="w-24 h-24 rounded-sm mx-auto" />
            </div>
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="py-64" aria-live="polite">
          <EmptyState 
            message="No matches for these filters. Try widening your rate range." 
            actionLabel="Clear all filters"
            onAction={onClearFilters}
          />
        </div>
      );
    }

    return (
      <div className="w-full" aria-live="polite">
        <div className="sr-only">Showing {data.length} results.</div>
        {data.map((f) => {
          const isSaved = shortlisted.has(f.id);
          const formattedMin = new Intl.NumberFormat(undefined, { style: 'currency', currency: f.currency, maximumFractionDigits: 0 }).format(f.rateMin);
          const formattedMax = new Intl.NumberFormat(undefined, { style: 'currency', currency: f.currency, maximumFractionDigits: 0 }).format(f.rateMax);
          return (
            <div 
              key={f.id} 
              onClick={() => handleRowClick(f.id)}
              className={`border-b border-border bg-surface hover:bg-surface-2 transition-colors duration-120 ease-in-out cursor-pointer group last:border-b-0 ${tableGrid}`}
            >
              {/* 1. Freelancer */}
              <div className="flex items-center gap-12 overflow-hidden">
                <Avatar src={f.avatarUrl} name={f.name} size="sm" />
                <span className="text-body text-text font-medium truncate">{f.name}</span>
                {f.verified && <Badge>VERIFIED</Badge>}
              </div>

              {/* 2. Role */}
              <div className="hidden md:block truncate text-body text-text-dim">
                {f.role}
              </div>

              {/* 3. Skills and Reasoning */}
              <div className="flex flex-col gap-4 overflow-hidden justify-center py-4">
                <div className="flex gap-4 overflow-hidden items-center">
                  {f.skills.slice(0, 2).map(s => (
                    <Chip key={s} interactive={false} className="!py-2 !px-4">{s}</Chip>
                  ))}
                  {f.skills.length > 2 && (
                    <span className="text-10 text-text-mute font-medium whitespace-nowrap">+{f.skills.length - 2}</span>
                  )}
                </div>
                {sortField === 'relevance' && reasoningData[f.id] && (
                  <p className="text-[11px] leading-tight text-text-dim truncate" title={reasoningData[f.id].reasoning}>
                    {reasoningData[f.id].reasoning}
                  </p>
                )}
              </div>

              {/* 4. Rate */}
              <div className="text-right font-mono tabular-nums text-body text-text">
                {formattedMin}–{formattedMax}/hr
              </div>

              {/* 5. Rating */}
              <div className="text-right font-mono tabular-nums text-body text-text">
                {f.rating.toFixed(1)}
              </div>

              {/* 6. Response time */}
              <div className="hidden lg:block text-right font-mono tabular-nums text-body text-text-dim">
                ~{f.responseTimeMinutes >= 60 ? `${Math.round(f.responseTimeMinutes / 60)}h` : `${f.responseTimeMinutes}m`}
              </div>

              {/* 7. Availability */}
              <div className="flex items-center gap-8 truncate">
                <StatusDot status={f.availability} />
                <span className="text-body text-text-dim truncate capitalize">{f.availability.replace('_', ' ')}</span>
              </div>

              {/* 8. Shortlist */}
              <div className="flex justify-center">
                <button
                  onClick={(e) => handleToggleShortlist(e, f.id)}
                  className="p-8 rounded-sm text-text-dim hover:text-accent-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-colors active:scale-95"
                  aria-label={isSaved ? "Remove from shortlist" : "Save to shortlist"}
                >
                  <Bookmark className="w-16 h-16" fill={isSaved ? "currentColor" : "none"} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-16">
      {/* Sort Controls */}
      <div className="flex items-center gap-16 px-16 text-micro-label uppercase tracking-[0.05em] h-32">
        <span className="text-text-mute">Sort by:</span>
        <div className="flex gap-16">
          {renderSortHeader('relevance', 'Relevance')}
          {renderSortHeader('rate', 'Rate')}
          {renderSortHeader('rating', 'Rating')}
          {renderSortHeader('response_time', 'Response time')}
        </div>
      </div>

      <div className="border border-border rounded-lg bg-surface overflow-hidden">
        {/* Header Row */}
        <div className={`border-b border-border bg-surface text-micro-label text-text-mute uppercase tracking-[0.05em] ${tableGrid}`}>
          <div>Freelancer</div>
          <div className="hidden md:block">Role</div>
          <div>Skills</div>
          <div className="text-right">Rate</div>
          <div className="text-right">Rating</div>
          <div className="hidden lg:block text-right">Response</div>
          <div>Availability</div>
          <div className="text-center">Save</div>
        </div>

        {/* Body */}
        <div className="flex flex-col">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
