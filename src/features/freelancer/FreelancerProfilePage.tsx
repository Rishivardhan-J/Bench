import React from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { getProvider, isDemoMode } from '@/lib/providers';
import { completenessChecks, computeCompleteness } from '@/lib/completeness';
import { coreChanged, saveFreelancerProfile, useOwnProfile } from '@/lib/data/profile';
import { errorMessage } from '@/lib/data/api';
import { useDebounce } from '@/hooks/useDebounce';
import { BasicsStep, ExperienceStep, PortfolioStep, SkillsStep } from './profileSteps';
import { STEPS, draftFromProfile, isSavableDraft, stepForError, toPayload, validateForSubmit } from './profileDraft';
import type { Draft, Errors, Step } from './profileDraft';

export const FreelancerProfilePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast, announce } = useToast();
  const uid = currentUser!.uid;
  const { data: profile, loading, error } = useOwnProfile(uid);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [step, setStep] = React.useState<Step>('basics');
  const [errors, setErrors] = React.useState<Errors>({});
  const [saving, setSaving] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [confirmOffline, setConfirmOffline] = React.useState(false);
  const savedSnapshot = React.useRef<string>('');
  const summaryRef = React.useRef<HTMLDivElement>(null);

  // Initialise the form once from the stored profile.
  React.useEffect(() => {
    if (profile && !draft) {
      const d = draftFromProfile(profile);
      setDraft(d);
      savedSnapshot.current = JSON.stringify(toPayload(d));
    }
  }, [profile, draft]);

  const [skillSuggestions, setSkillSuggestions] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (isDemoMode()) return;
    getProvider().getAvailableSkills().then(setSkillSuggestions).catch(() => undefined);
  }, []);

  const set = React.useCallback((patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d)), []);

  const live = profile?.approved === true;
  const payloadJson = draft ? JSON.stringify(toPayload(draft)) : '';
  const dirty = Boolean(draft) && payloadJson !== savedSnapshot.current;

  // Autosave drafts. A live profile is never autosaved because editing core fields takes it offline.
  const debouncedJson = useDebounce(payloadJson, 1500);
  React.useEffect(() => {
    if (!draft || !profile || live || debouncedJson !== payloadJson || debouncedJson === savedSnapshot.current) return;
    if (!isSavableDraft(draft)) return;
    let cancelled = false;
    setSaveState('saving');
    saveFreelancerProfile(uid, profile, toPayload(draft), { submit: false })
      .then(() => {
        if (cancelled) return;
        savedSnapshot.current = debouncedJson;
        setSaveState('saved');
      })
      .catch(() => !cancelled && setSaveState('failed'));
    return () => {
      cancelled = true;
    };
  }, [debouncedJson]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || (profile && !draft)) {
    return (
      <Page title="Your profile" width="form">
        <PageHeader title="Your profile" />
        <div aria-busy="true"><span className="sr-only" role="status">Loading your profile</span><Skeleton className="h-48 w-full mb-24" /><Skeleton className="h-320 w-full" /></div>
      </Page>
    );
  }
  if (error || !profile || !draft) {
    return <Page title="Your profile" width="form"><ErrorState message="We couldn't load your profile. Please refresh the page." onRetry={() => window.location.reload()} /></Page>;
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const completeness = computeCompleteness({ ...toPayload(draft), avatarUrl: draft.avatarUrl || undefined, portfolioUrl: draft.portfolioUrl || undefined });
  const missing = completenessChecks({ ...toPayload(draft) }).filter((c) => !c.done);

  const persist = async (submit: boolean) => {
    setSaving(true);
    try {
      const payload = toPayload(draft);
      const { status, wentOffline } = await saveFreelancerProfile(uid, profile, payload, { submit });
      savedSnapshot.current = JSON.stringify(payload);
      setSaveState('saved');
      if (status === 'pending') toast(wentOffline ? 'Saved. Your profile is back in review and hidden from search until approved.' : 'Submitted for review. We will let you know the decision.');
      else toast('Saved.');
    } catch (err) {
      setSaveState('failed');
      toast(errorMessage(err, "We couldn't save your profile. Please try again."));
    } finally {
      setSaving(false);
      setConfirmOffline(false);
    }
  };

  const onSaveDraft = () => {
    if (!isSavableDraft(draft)) return toast('Fix the rate range first: the maximum must be at least the minimum.');
    if (live && coreChanged(profile, toPayload(draft) as never)) return setConfirmOffline(true);
    void persist(false);
  };

  const onSubmit = () => {
    const found = validateForSubmit(draft);
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      setStep(stepForError(keys[0]));
      announce(`${keys.length} ${keys.length === 1 ? 'thing needs' : 'things need'} attention before you can submit.`);
      window.setTimeout(() => summaryRef.current?.focus(), 50);
      return;
    }
    void persist(true);
  };

  const body = (() => {
    const props = { draft, set, errors, uid, skillSuggestions };
    switch (step) {
      case 'basics': return <BasicsStep {...props} />;
      case 'skills': return <SkillsStep {...props} />;
      case 'experience': return <ExperienceStep {...props} />;
      case 'portfolio': return <PortfolioStep {...props} />;
      case 'review':
        return (
          <div className="flex flex-col gap-24">
            <ProgressMeter value={completeness} label="Profile completeness" />
            {missing.length > 0 ? (
              <div>
                <h3 className="text-body font-semibold text-text mb-8">To improve your profile</h3>
                <ul className="list-disc pl-20 text-body text-text-dim flex flex-col gap-4">{missing.map((m) => (<li key={m.id}>{m.label}</li>))}</ul>
              </div>
            ) : (
              <p className="text-body text-text-dim">Your profile is complete.</p>
            )}
            <p className="text-body text-text-dim max-w-prose">
              {live ? 'Your profile is live. Changing core details will return it to review.' : 'When you submit, the Bench team reviews your profile. Once approved, it appears in search.'}
            </p>
          </div>
        );
    }
  })();

  const errorKeys = Object.keys(errors);

  return (
    <Page title="Your profile" width="form">
      <PageHeader
        title="Your profile"
        description={live ? 'Your profile is live.' : 'Build a profile clients can trust. We save drafts as you go.'}
        actions={<Link to="/freelancer/status" className="text-meta text-text-dim hover:text-text underline underline-offset-4 rounded-sm">Status and completeness</Link>}
      />

      <nav aria-label="Profile steps" className="mb-24">
        <ol className="flex flex-wrap gap-4">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(s.id)}
                aria-current={step === s.id ? 'step' : undefined}
                className={`h-32 px-12 rounded-md text-meta transition-colors duration-120 ${step === s.id ? 'bg-surface-3 text-text font-medium' : 'text-text-dim hover:text-text hover:bg-surface-2'}`}
              >
                <span className="font-mono tabular-nums mr-8">{i + 1}</span>{s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {errorKeys.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-24 p-16 border border-border-strong bg-surface-2 rounded-md">
          <p className="text-body font-medium text-text mb-8">Please fix these before submitting:</p>
          <ul className="list-disc pl-20 text-meta text-text-dim">
            {errorKeys.map((k) => (<li key={k}><button type="button" onClick={() => setStep(stepForError(k))} className="underline underline-offset-4 text-text rounded-sm">{errors[k]}</button></li>))}
          </ul>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-24 sm:p-32 mb-24">{body}</div>

      <div className="sticky bottom-0 bg-bg/95 border-t border-border py-12 flex flex-wrap items-center justify-between gap-12">
        <p role="status" className="text-meta text-text-dim min-h-24">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' && !dirty ? 'All changes saved' : saveState === 'failed' ? "Couldn't save. We'll keep trying." : live ? (dirty ? 'Unsaved changes' : '') : dirty ? 'Saving soon…' : ''}
        </p>
        <div className="flex items-center gap-8">
          <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1].id)}>Back</Button>
          {stepIndex < STEPS.length - 1 ? (
            <Button variant="secondary" onClick={() => setStep(STEPS[stepIndex + 1].id)}>Next</Button>
          ) : null}
          <Button variant={stepIndex === STEPS.length - 1 ? 'secondary' : 'ghost'} loading={saving} disabled={!dirty} onClick={onSaveDraft}>{live ? 'Save changes' : 'Save draft'}</Button>
          {(!live || stepIndex === STEPS.length - 1) && !live && <Button loading={saving} onClick={onSubmit}>{profile.reviewStatus === 'pending' ? 'Resubmit' : 'Submit for review'}</Button>}
        </div>
      </div>

      <Dialog open={confirmOffline} onClose={() => setConfirmOffline(false)} title="Take your profile offline?" description="You changed core details. Your profile will be hidden from search until the Bench team reviews it again.">
        <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setConfirmOffline(false)}>Keep editing</Button><Button loading={saving} onClick={() => persist(true)}>Save and resubmit</Button></div>
      </Dialog>
    </Page>
  );
};
