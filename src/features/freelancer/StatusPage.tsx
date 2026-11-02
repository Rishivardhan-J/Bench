import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Circle } from 'lucide-react';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Badge';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { completenessChecks } from '@/lib/completeness';
import { setProfilePaused, useOwnProfile } from '@/lib/data/profile';
import { ReviewSection } from '@/features/profile/ReviewSection';

const STATUS_COPY: Record<string, { label: string; body: string }> = {
  draft: { label: 'Draft', body: 'Your profile is saved but not submitted. Finish it and submit it for review.' },
  pending: { label: 'Pending review', body: 'The Bench team is reviewing your profile. You will be notified when there is a decision.' },
  approved: { label: 'Live', body: 'Your profile is live and clients can find you in search.' },
  changes_requested: { label: 'Changes requested', body: 'Please update your profile based on the note below, then submit again.' },
};

export const StatusPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { data: profile, loading, error } = useOwnProfile(currentUser?.uid ?? null);
  const [busy, setBusy] = React.useState(false);

  if (loading) return <Page title="Status"><PageHeader title="Profile status" /><div aria-busy="true"><span className="sr-only" role="status">Loading status</span><Skeleton className="h-96 w-full" /></div></Page>;
  if (error || !profile) return <Page title="Status"><ErrorState message="We couldn't load your profile." /></Page>;

  const status = profile.reviewStatus ?? 'draft';
  const copy = STATUS_COPY[status] ?? STATUS_COPY.draft;
  const checks = completenessChecks(profile);
  const completeness = profile.completeness ?? checks.reduce((n, c) => n + (c.done ? c.weight : 0), 0);
  const publicUrl = `${window.location.origin}/freelancer/${profile.id}`;
  const live = profile.approved === true;

  const togglePause = async () => {
    setBusy(true);
    try {
      await setProfilePaused(!profile.paused);
      toast(profile.paused ? 'Your profile is visible again.' : 'Your profile is hidden from search.');
    } catch {
      toast("Couldn't update that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast('Link copied.');
    } catch {
      toast(publicUrl);
    }
  };

  return (
    <Page title="Status">
      <PageHeader
        title="Profile status"
        actions={<ButtonLink to="/freelancer/profile" variant="secondary">Edit profile</ButtonLink>}
      />

      <div className="grid lg:grid-cols-3 gap-24 mb-40">
        <section aria-labelledby="status-title" className="lg:col-span-2 p-24 border border-border rounded-lg bg-surface">
          <div className="flex items-center gap-12 mb-12">
            <h2 id="status-title" className="text-section-heading text-text">{copy.label}</h2>
            {profile.paused && <Pill>Paused</Pill>}
          </div>
          <p className="text-body text-text-dim mb-16 max-w-prose">{copy.body}</p>
          {status === 'changes_requested' && profile.reviewNote && (
            <blockquote className="p-16 mb-16 rounded-md border border-border-strong bg-surface-2 text-body text-text">{profile.reviewNote}</blockquote>
          )}
          <div className="flex flex-wrap gap-8">
            {(status === 'draft' || status === 'changes_requested') && <ButtonLink to="/freelancer/profile">Finish and submit</ButtonLink>}
            {live && <ButtonLink to={`/freelancer/${profile.id}`} variant="secondary">View public profile</ButtonLink>}
            {live && <Button variant="secondary" onClick={copyLink}><Copy className="w-16 h-16" aria-hidden="true" />Copy public link</Button>}
            {live && <Button variant="ghost" loading={busy} onClick={togglePause}>{profile.paused ? 'Resume visibility' : 'Pause profile'}</Button>}
          </div>
          {live && <p className="text-meta text-text-dim mt-12">Changing your name, headline, bio, skills, rate or other core details returns your profile to review. Availability and pausing do not.</p>}
        </section>

        <section aria-labelledby="complete-title" className="p-24 border border-border rounded-lg bg-surface">
          <h2 id="complete-title" className="sr-only">Profile completeness</h2>
          <ProgressMeter value={completeness} label="Profile completeness" className="mb-16" />
          <ul className="flex flex-col gap-8">
            {checks.map((c) => (
              <li key={c.id} className="flex items-center gap-8 text-meta">
                {c.done ? <Check className="w-16 h-16 text-text" aria-hidden="true" /> : <Circle className="w-16 h-16 text-text-dim" aria-hidden="true" />}
                <span className={c.done ? 'text-text-dim' : 'text-text'}>{c.label}</span>
                <span className="sr-only">{c.done ? 'done' : 'to do'}</span>
              </li>
            ))}
          </ul>
          <p className="text-meta text-text-dim mt-16">Profiles above 80% rank slightly higher in search.</p>
        </section>
      </div>

      {live ? (
        <ReviewSection freelancer={profile} />
      ) : (
        <p className="text-body text-text-dim">Reviews from clients will show here once your profile is live. <Link to="/freelancer/profile" className="text-text underline underline-offset-4">Edit your profile</Link></p>
      )}
    </Page>
  );
};
