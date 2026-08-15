import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DemoFreelancerProvider } from '@/lib/providers/freelancer-provider';
import { aiService } from '@/lib/services/ai-service';
import { useShortlist } from '@/lib/providers/ShortlistContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { StatusDot } from '@/components/ui/StatusDot';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { Bookmark, ExternalLink, ArrowLeft } from 'lucide-react';

const provider = new DemoFreelancerProvider();

export const FreelancerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { shortlisted, toggleShortlist } = useShortlist();
  const [showRawReviews, setShowRawReviews] = React.useState(false);

  const { data: freelancer, isLoading, isError, refetch } = useQuery({
    queryKey: ['freelancer', id],
    queryFn: () => provider.getById(id!),
    enabled: !!id,
  });

  const { data: reviewSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['reviewSummary', id],
    queryFn: () => aiService.summarizeReviews(id!, freelancer!.reviews || []),
    enabled: !!freelancer && !!freelancer.reviews && freelancer.reviews.length > 0,
  });

  if (isError) {
    return (
      <div className="w-full max-w-[920px] mx-auto px-24 py-48">
        <ErrorState message="Failed to load freelancer details." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !freelancer) {
    return (
      <div className="w-full max-w-[920px] mx-auto px-24 pt-48 pb-64 animate-in fade-in duration-300">
        <div className="mb-32">
          <Skeleton className="w-120 h-24" />
        </div>
        <div className="flex items-start justify-between mb-32">
          <div className="flex gap-24 items-center">
            <Skeleton className="w-64 h-64 rounded-full" />
            <div className="flex flex-col gap-8">
              <Skeleton className="w-200 h-32" />
              <Skeleton className="w-160 h-24" />
            </div>
          </div>
          <Skeleton className="w-48 h-48 rounded-sm" />
        </div>
        <div className="flex gap-32 mb-48">
          <Skeleton className="w-80 h-48" />
          <Skeleton className="w-80 h-48" />
          <Skeleton className="w-80 h-48" />
          <Skeleton className="w-80 h-48" />
        </div>
        <div className="space-y-16 mb-48">
          <Skeleton className="w-full h-16" />
          <Skeleton className="w-full h-16" />
          <Skeleton className="w-3/4 h-16" />
        </div>
      </div>
    );
  }

  const isSaved = shortlisted.has(freelancer.id);

  return (
    <div className="w-full max-w-[920px] mx-auto px-24 pt-48 pb-64">
      <Link 
        to="/" 
        className="inline-flex items-center gap-8 text-meta text-text-dim hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm mb-32 transition-colors"
      >
        <ArrowLeft className="w-16 h-16" />
        <span>Back to results</span>
      </Link>

      <div className="flex items-start justify-between mb-32">
        <div className="flex gap-24 items-center">
          <Avatar 
            src={freelancer.avatarUrl} 
            name={freelancer.name} 
            className="!w-64 !h-64 !text-section-heading" 
          />
          <div>
            <div className="flex items-center gap-12 mb-4">
              <h1 className="text-section-heading text-text">{freelancer.name}</h1>
              {freelancer.verified && <Badge>VERIFIED</Badge>}
            </div>
            <div className="flex flex-col gap-4 text-body text-text-dim">
              <p>{freelancer.role}</p>
              <p className="text-11 text-text-mute">
                {new Intl.DateTimeFormat(undefined, { timeZone: freelancer.timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date())} local time
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => toggleShortlist(freelancer.id)}
          className={`p-12 border rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent active:scale-95 flex items-center justify-center ${isSaved ? 'bg-surface-2 border-border-strong text-accent-text' : 'bg-surface border-border text-text-dim hover:text-text'}`}
          aria-label={isSaved ? "Remove from shortlist" : "Save to shortlist"}
        >
          <Bookmark className="w-20 h-20" fill={isSaved ? "currentColor" : "none"} strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-24 mb-48 p-24 bg-surface rounded-lg border border-border">
        <div className="flex flex-col gap-8">
          <span className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Rate</span>
          <span className="font-mono tabular-nums text-body text-text">
            {new Intl.NumberFormat(undefined, { style: 'currency', currency: freelancer.currency, maximumFractionDigits: 0 }).format(freelancer.rateMin)}–{new Intl.NumberFormat(undefined, { style: 'currency', currency: freelancer.currency, maximumFractionDigits: 0 }).format(freelancer.rateMax)}/hr
          </span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Rating</span>
          <span className="font-mono tabular-nums text-body text-text">{freelancer.rating.toFixed(1)}</span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Response</span>
          <span className="font-mono tabular-nums text-body text-text">
            ~{freelancer.responseTimeMinutes >= 60 ? `${Math.round(freelancer.responseTimeMinutes / 60)}h` : `${freelancer.responseTimeMinutes}m`}
          </span>
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Availability</span>
          <div className="flex items-center gap-8">
            <StatusDot status={freelancer.availability} />
            <span className="text-body text-text capitalize">{freelancer.availability.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="mb-48">
        <h2 className="text-meta font-semibold text-text mb-16">Skills</h2>
        <div className="flex flex-wrap gap-8">
          {freelancer.skills.map(s => (
            <Chip key={s} interactive={false}>{s}</Chip>
          ))}
        </div>
      </div>

      <div className="mb-48">
        <h2 className="text-meta font-semibold text-text mb-16">Bio</h2>
        <p className="text-body text-text-dim whitespace-pre-wrap max-w-[80ch]">
          {freelancer.bio}
        </p>
      </div>

      {freelancer.portfolioUrl && (
        <div className="mb-48">
          <h2 className="text-meta font-semibold text-text mb-16">Portfolio</h2>
          <a 
            href={freelancer.portfolioUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label={`Visit ${freelancer.name}'s portfolio in a new tab`}
            className="inline-flex items-center gap-8 text-body text-accent-text hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm"
          >
            <ExternalLink className="w-16 h-16" />
            <span>{freelancer.portfolioUrl}</span>
          </a>
        </div>
      )}

      {freelancer.reviews && freelancer.reviews.length > 0 && (
        <div className="mb-48">
          <h2 className="text-meta font-semibold text-text mb-16">What people say</h2>
          
          <div className="p-16 border border-border bg-surface rounded-md mb-16">
            {isSummaryLoading ? (
              <div className="space-y-8 animate-in fade-in">
                <Skeleton className="w-full h-16" />
                <Skeleton className="w-5/6 h-16" />
                <Skeleton className="w-2/3 h-16" />
              </div>
            ) : (
              <p className="text-body text-text-dim">
                {reviewSummary?.summary || "Not enough reviews yet to generate a summary."}
              </p>
            )}
          </div>

          <button 
            onClick={() => setShowRawReviews(!showRawReviews)}
            className="text-meta text-text-dim hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm underline underline-offset-4 mb-16 transition-colors"
          >
            {showRawReviews ? 'Hide raw reviews' : 'Show all reviews'}
          </button>

          {showRawReviews && (
            <div className="flex flex-col gap-16 animate-in slide-in-from-top-2 fade-in duration-200">
              {freelancer.reviews.map((r, i) => (
                <div key={i} className="p-16 border border-border bg-surface rounded-md">
                  <div className="font-mono text-meta text-text mb-8">{r.rating.toFixed(1)} / 5.0</div>
                  <p className="text-body text-text-dim">"{r.text}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
