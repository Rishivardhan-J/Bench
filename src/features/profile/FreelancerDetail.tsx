import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Globe } from 'lucide-react';
import { Page, usePageMeta, usePageTitle } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge, Pill } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { Menu } from '@/components/ui/Menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusDot } from '@/components/ui/StatusDot';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SaveButton } from '@/components/freelancer/SaveButton';
import { useAuth } from '@/lib/providers/AuthContext';
import { getProvider, isDemoMode } from '@/lib/providers';
import { useOwnProfile, trackProfileView } from '@/lib/data/profile';
import { useOutgoingConnections } from '@/lib/data/messaging';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { availabilityLabel, formatRate, formatRating, formatResponseTime, localTime } from '@/lib/format';
import { ConnectDialog } from './ConnectDialog';
import { ReportDialog } from './ReportDialog';
import { ReviewSection } from './ReviewSection';
import { TrackRecord } from './TrackRecord';

const DECLINE_COPY = { booked: 'fully booked', budget: 'budget', skills: 'outside their skills', other: 'other' } as const;

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-8">
    <dt className="text-meta text-text-dim">{label}</dt>
    <dd className="text-body text-text">{children}</dd>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-40">
    <h2 className="text-body font-semibold text-text mb-16">{title}</h2>
    {children}
  </section>
);

export const FreelancerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const provider = React.useMemo(() => getProvider(), []);
  const { currentUser, role, openSignInModal } = useAuth();
  const { remember } = useRecentlyViewed();

  const publicQuery = useQuery({
    queryKey: ['freelancer', id],
    queryFn: () => provider.getById(id!),
    enabled: Boolean(id),
  });

  // A freelancer previewing their own, not-yet-live profile.
  const isOwner = Boolean(currentUser && currentUser.uid === id);
  const own = useOwnProfile(isOwner ? id! : null);
  const freelancer = publicQuery.data ?? (isOwner ? own.data : null);
  const previewOnly = isOwner && !publicQuery.data && Boolean(own.data);

  usePageTitle(freelancer ? `${freelancer.name}, ${freelancer.headline}` : 'Freelancer');
  usePageMeta(freelancer ? { title: `${freelancer.name} on Bench`, description: `${freelancer.headline}. ${formatRate(freelancer)}. ${freelancer.bio.slice(0, 120)}` } : null);

  React.useEffect(() => {
    if (!freelancer || previewOnly) return;
    remember(freelancer.id);
    if (!isDemoMode()) void trackProfileView({ freelancerUid: freelancer.id }).catch(() => undefined);
  }, [freelancer?.id, previewOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const outgoing = useOutgoingConnections(role === 'client' && currentUser ? currentUser.uid : null);
  const connection = outgoing.data.find((c) => c.freelancerUid === id);

  const [connectOpen, setConnectOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [afterAuthConnect, setAfterAuthConnect] = React.useState(false);

  React.useEffect(() => {
    if (afterAuthConnect && role === 'client') {
      setAfterAuthConnect(false);
      setConnectOpen(true);
    }
  }, [afterAuthConnect, role]);

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  const BackLink = (
    <button type="button" onClick={goBack} className="inline-flex items-center gap-8 text-meta text-text-dim hover:text-text rounded-sm mb-24">
      <ArrowLeft className="w-16 h-16" aria-hidden="true" />
      Back to results
    </button>
  );

  if (publicQuery.isError) {
    return (
      <Page width="narrow">
        <ErrorState message="We couldn't load this profile." onRetry={() => publicQuery.refetch()} />
      </Page>
    );
  }

  if (publicQuery.isLoading || (isOwner && own.loading && !freelancer)) {
    return (
      <Page width="narrow">
        <div aria-busy="true">
          <span className="sr-only" role="status">Loading profile</span>
          <Skeleton className="w-120 h-16 mb-24" />
          <div className="flex gap-24 items-center mb-32"><Skeleton className="w-64 h-64 rounded-full" /><div className="flex flex-col gap-8"><Skeleton className="w-200 h-32" /><Skeleton className="w-160 h-16" /></div></div>
          <Skeleton className="w-full h-96 mb-32" />
          <Skeleton className="w-full h-16 mb-8" /><Skeleton className="w-3/4 h-16" />
        </div>
      </Page>
    );
  }

  if (!freelancer) {
    return (
      <Page width="narrow">
        <EmptyState title="This profile isn't available" message="It may have been paused or removed." actionLabel="Back to search" onAction={() => navigate('/')} />
      </Page>
    );
  }

  const rating = formatRating(freelancer.ratingAvg);
  const response = formatResponseTime(freelancer.avgResponseMinutes);
  const clock = localTime(freelancer.timezone);
  const firstName = freelancer.name.split(' ')[0];

  const connectControl = (() => {
    if (previewOnly || isOwner || role === 'freelancer' || role === 'admin') return null;
    if (connection?.status === 'accepted') return <ButtonLink to={`/messages/${connection.threadId ?? connection.id}`}>Message {firstName}</ButtonLink>;
    if (connection?.status === 'pending') return <Button disabled>Request sent</Button>;
    return (
      <Button
        onClick={() =>
          currentUser
            ? setConnectOpen(true)
            : openSignInModal({ mode: 'signup', reason: `Create a free client account to connect with ${firstName}.`, onSuccess: () => setAfterAuthConnect(true) })
        }
      >
        Connect
      </Button>
    );
  })();

  return (
    <Page width="narrow">
      {BackLink}

      {previewOnly && (
        <div role="status" className="mb-24 p-12 rounded-md border border-border-strong bg-surface-2 text-body text-text-dim">
          This is a preview of your profile. It isn't visible in search until the Bench team approves it.{' '}
          <Link to="/freelancer/status" className="text-text underline underline-offset-4">See status</Link>
        </div>
      )}

      {connection?.status === 'declined' && (
        <div role="status" className="mb-24 p-12 rounded-md border border-border-strong bg-surface-2 text-body text-text-dim">
          {firstName} can't take this on{connection.declineReason ? ` (${DECLINE_COPY[connection.declineReason]})` : ''}.{' '}
          {connection.referredFreelancerId && (
            <>They recommended <Link to={`/freelancer/${connection.referredFreelancerId}`} className="text-text underline underline-offset-4">{connection.referredName ?? 'someone else'}</Link>.</>
          )}
        </div>
      )}
      {connection?.status === 'expired' && (
        <div role="status" className="mb-24 p-12 rounded-md border border-border-strong bg-surface-2 text-body text-text-dim">
          {firstName} didn't reply in time, so your request closed. You can send it again.
        </div>
      )}

      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-24 mb-32">
        <div className="flex gap-16 sm:gap-24 items-center min-w-0">
          <Avatar src={freelancer.avatarUrl} name={freelancer.name} size="xl" />
          <div className="min-w-0">
            <div className="flex items-center gap-12 flex-wrap mb-4">
              <h1 className="text-section-heading text-text">{freelancer.name}</h1>
              {freelancer.verified && <VerifiedBadge />}
            </div>
            <p className="text-body text-text-dim">{freelancer.headline}</p>
            {clock && <p className="text-meta text-text-dim mt-4">{clock} local time</p>}
          </div>
        </div>

        <div className="flex items-center gap-8 flex-shrink-0">
          {!previewOnly && !isOwner && <SaveButton id={freelancer.id} name={freelancer.name} variant="framed" />}
          {connectControl}
          {!previewOnly && !isOwner && currentUser && !isDemoMode() && (
            <Menu
              label="More actions"
              trigger={<span className="inline-flex items-center justify-center w-44 h-44 rounded-md border border-border text-text-dim hover:text-text" aria-hidden="true">···</span>}
              items={[{ label: 'Report this profile', onSelect: () => setReportOpen(true) }]}
            />
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-24 mb-40 p-24 bg-surface rounded-lg border border-border">
        <Stat label="Rate"><span className="font-mono tabular-nums">{formatRate(freelancer)}</span></Stat>
        <Stat label="Rating">
          {rating ? (
            <span className="font-mono tabular-nums">{rating}<span className="text-text-dim"> ({freelancer.reviewCount ?? 0})</span></span>
          ) : (
            <Pill>New</Pill>
          )}
        </Stat>
        <Stat label="Response time">
          {response ? <span className="font-mono tabular-nums">{response}</span> : <span className="text-text-dim">Not enough replies yet</span>}
        </Stat>
        <Stat label="Availability">
          <span className="flex items-center gap-8">
            <StatusDot status={freelancer.availability} />
            {availabilityLabel(freelancer.availability)}
          </span>
          {freelancer.availability === 'offline' && freelancer.backOn && (
            <span className="block text-meta text-text-dim mt-4">Back on {new Date(freelancer.backOn + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </Stat>
      </dl>

      <Section title="Skills">
        <div className="flex flex-wrap gap-8">{freelancer.skills.map((s) => (<Tag key={s}>{s}</Tag>))}</div>
      </Section>

      <Section title="About">
        <p className="text-body text-text-dim whitespace-pre-wrap max-w-prose">{freelancer.bio}</p>
        {(freelancer.languages?.length ?? 0) > 0 && (
          <p className="flex items-center gap-8 text-meta text-text-dim mt-12"><Globe className="w-16 h-16" aria-hidden="true" />Speaks {freelancer.languages.join(', ')}</p>
        )}
      </Section>

      {(freelancer.experience?.length ?? 0) > 0 && (
        <Section title="Experience">
          <ul className="flex flex-col gap-16">
            {freelancer.experience.map((e, i) => (
              <li key={i} className="flex flex-col gap-4">
                <p className="text-body text-text">{e.title} <span className="text-text-dim">at {e.company}</span></p>
                <p className="text-meta text-text-dim font-mono tabular-nums">{e.startYear} – {e.endYear ?? 'Present'}</p>
                {e.description && <p className="text-body text-text-dim max-w-prose">{e.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(freelancer.education?.length ?? 0) > 0 && (
        <Section title="Education">
          <ul className="flex flex-col gap-12">
            {freelancer.education.map((e, i) => (
              <li key={i} className="text-body text-text">{e.degree} <span className="text-text-dim">, {e.school}{e.endYear ? ` (${e.endYear})` : ''}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {((freelancer.portfolio?.length ?? 0) > 0 || freelancer.portfolioUrl) && (
        <Section title="Portfolio">
          {(freelancer.portfolio?.length ?? 0) > 0 && (
            <ul className="grid sm:grid-cols-2 gap-12 mb-16">
              {freelancer.portfolio.map((p, i) => (
                <li key={i} className="border border-border rounded-md bg-surface overflow-hidden">
                  {p.imageUrl && <img src={p.imageUrl} alt="" loading="lazy" className="w-full h-160 object-cover" />}
                  <div className="p-16">
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-8 text-body font-medium text-text hover:underline underline-offset-4 rounded-sm">
                      {p.title}
                      <ExternalLink className="w-12 h-12" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                    {p.description && <p className="text-meta text-text-dim mt-4">{p.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {freelancer.portfolioUrl && (
            <a href={freelancer.portfolioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-8 text-body text-accent-text hover:underline underline-offset-4 rounded-sm">
              <ExternalLink className="w-16 h-16" aria-hidden="true" />
              {freelancer.portfolioUrl.replace(/^https?:\/\//, '')}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </Section>
      )}

      {!previewOnly && !isDemoMode() && <TrackRecord freelancerId={freelancer.id} />}

      {!previewOnly && <ReviewSection freelancer={freelancer} connection={connection} />}

      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} freelancerUid={freelancer.id} freelancerName={freelancer.name} />
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="profile" targetId={freelancer.id} label={freelancer.name} />
    </Page>
  );
};
