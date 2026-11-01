import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { RatingInput } from '@/components/ui/RatingInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { isDemoMode } from '@/lib/providers';
import { aiService } from '@/lib/services/ai-service';
import { errorMessage } from '@/lib/data/api';
import { createReview, markHire, replyToReview } from '@/lib/data/messaging';
import { useHires, useReview, useReviews } from '@/lib/data/profile';
import type { ReviewWithName } from '@/lib/data/profile';
import { formatRelative } from '@/lib/format';
import type { Connection, Freelancer } from '@/types';

interface Props {
  freelancer: Freelancer;
  connection?: Connection;
}

function localSummary(reviews: { rating: number; text: string }[]): string {
  const avg = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;
  return `Rated ${avg.toFixed(1)} out of 5 across ${reviews.length} review${reviews.length === 1 ? '' : 's'}.`;
}

const ReplyForm: React.FC<{ reviewId: string }> = ({ reviewId }) => {
  const { toast } = useToast();
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await replyToReview({ reviewId, text });
      toast('Reply posted.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-12 flex flex-col gap-8">
      <Field label="Reply (you can reply once)" error={error}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={800} rows={3} />
      </Field>
      <div className="flex justify-end"><Button size="sm" type="submit" loading={busy} disabled={text.trim().length < 2}>Post reply</Button></div>
    </form>
  );
};

const ReviewForm: React.FC<{ hireId: string }> = ({ hireId }) => {
  const { toast } = useToast();
  const [rating, setRating] = React.useState(0);
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return setError('Choose a rating from 1 to 5.');
    setBusy(true);
    setError(null);
    try {
      await createReview({ hireId, rating, text });
      toast('Thanks for the review.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-16 border border-border rounded-md bg-surface flex flex-col gap-16" noValidate>
      <h3 className="text-body font-semibold text-text">Leave a review</h3>
      {error && <div role="alert" className="p-12 bg-surface-2 border border-border-strong text-meta text-text rounded-sm">{error}</div>}
      <RatingInput value={rating} onChange={setRating} label="Rating" />
      <Field label="Your experience" required hint="Reviews are public and tied to a real engagement.">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={4} />
      </Field>
      <div className="flex justify-end"><Button type="submit" loading={busy} disabled={text.trim().length < 10}>Post review</Button></div>
    </form>
  );
};

export const ReviewSection: React.FC<Props> = ({ freelancer, connection }) => {
  const { currentUser, role } = useAuth();
  const { toast } = useToast();
  const demo = isDemoMode();
  const [showAll, setShowAll] = React.useState(false);
  const [hiring, setHiring] = React.useState(false);

  const live = useReviews(demo ? null : freelancer.id);
  const reviews: ReviewWithName[] = demo
    ? (freelancer.reviews ?? []).map((r, i) => ({ id: `demo-${i}`, hireId: '', clientUid: '', freelancerUid: freelancer.id, rating: r.rating, text: r.text }))
    : live.data;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reviewSummary', freelancer.id, reviews.length],
    queryFn: () => aiService.summarizeReviews(freelancer.id),
    enabled: !demo && reviews.length > 0,
    retry: false,
  });

  const isClient = role === 'client' && currentUser;
  const isOwner = currentUser?.uid === freelancer.id;
  const hires = useHires(isClient ? currentUser.uid : null);
  const hireId = isClient ? `${currentUser.uid}_${freelancer.id}` : null;
  const hired = hires.data.some((h) => h.freelancerUid === freelancer.id && !h.projectId);
  const existingReview = useReview(hired ? hireId : null);

  const onHire = async () => {
    setHiring(true);
    try {
      await markHire({ freelancerUid: freelancer.id });
      toast(`Marked as hired. You can review ${freelancer.name.split(' ')[0]} after you've talked.`);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setHiring(false);
    }
  };

  const visible = showAll ? reviews : [];
  const summaryText = summary?.summary ?? (reviews.length > 0 ? localSummary(reviews) : '');

  return (
    <section aria-labelledby="reviews-title" className="mb-48">
      <h2 id="reviews-title" className="text-body font-semibold text-text mb-16">What people say</h2>

      {reviews.length === 0 ? (
        <p className="text-body text-text-dim">No reviews yet. Reviews appear after a hire is marked and the two sides have talked.</p>
      ) : (
        <>
          <div className="p-16 border border-border bg-surface rounded-md mb-12">
            {summaryLoading ? (
              <div className="flex flex-col gap-8" aria-busy="true"><span className="sr-only" role="status">Loading summary</span><Skeleton className="w-full h-16" /><Skeleton className="w-3/4 h-16" /></div>
            ) : (
              <p className="text-body text-text-dim">{summaryText}</p>
            )}
          </div>
          <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="text-meta text-text-dim hover:text-text underline underline-offset-4 rounded-sm mb-12">
            {showAll ? 'Hide reviews' : `Read all ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}
          </button>
          {visible.length > 0 && (
            <ul className="flex flex-col gap-12 animate-fade-in">
              {visible.map((r) => (
                <li key={r.id} className="p-16 border border-border bg-surface rounded-md">
                  <div className="flex items-center justify-between mb-8">
                    <span className="font-mono tabular-nums text-meta text-text">{r.rating.toFixed(1)} / 5</span>
                    <span className="text-meta text-text-dim">{[r.clientName, formatRelative(r.createdAt)].filter(Boolean).join(' · ')}</span>
                  </div>
                  <p className="text-body text-text-dim">{r.text}</p>
                  {r.reply && (
                    <div className="mt-12 pl-12 border-l-2 border-border-strong">
                      <p className="text-meta text-text-dim mb-4">Reply from {freelancer.name.split(' ')[0]}</p>
                      <p className="text-body text-text-dim">{r.reply}</p>
                    </div>
                  )}
                  {isOwner && !r.reply && <ReplyForm reviewId={r.id} />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {isClient && connection?.status === 'accepted' && !demo && (
        <div className="mt-24">
          {!hired ? (
            <div className="p-16 border border-border rounded-md bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-12">
              <p className="text-body text-text-dim">Working with {freelancer.name.split(' ')[0]}? Mark them as hired to unlock reviews.</p>
              <Button variant="secondary" onClick={onHire} loading={hiring}>Mark as hired</Button>
            </div>
          ) : existingReview.data ? (
            <p className="text-body text-text-dim">You reviewed {freelancer.name.split(' ')[0]}. Thank you.</p>
          ) : hireId ? (
            <ReviewForm hireId={hireId} />
          ) : null}
        </div>
      )}
    </section>
  );
};
