import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { FileDrop } from '@/components/ui/FileDrop';
import { TagInput } from '@/components/ui/TagInput';
import { useToast } from '@/components/ui/Toast';
import { AVAILABILITY_OPTIONS } from '@/lib/format';
import { aiService } from '@/lib/services/ai-service';
import type { ResumeSuggestions } from '@/lib/services/ai-service';
import { uploadPublicImage, uploadResume } from '@/lib/data/profile';
import { errorMessage } from '@/lib/data/api';
import { LIMITS } from './profileDraft';
import type { Draft, Errors } from './profileDraft';

export interface StepProps {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  errors: Errors;
  uid: string;
  skillSuggestions: string[];
}

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
})();

const blockClass = 'p-16 border border-border rounded-md bg-surface flex flex-col gap-12';

/* ---------------------------------------------------------------- Resume */

const ResumePanel: React.FC<{ uid: string; draft: Draft; set: StepProps['set'] }> = ({ uid, draft, set }) => {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<ResumeSuggestions | null>(null);
  const [pick, setPick] = React.useState({ name: true, headline: true, skills: true, experience: true, education: true });

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const path = await uploadResume(uid, file);
      const suggestions = await aiService.parseResume(path);
      setFound(suggestions);
    } catch (err) {
      setError(errorMessage(err, "We couldn't read that resume. You can fill the form in by hand."));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!found) return;
    const patch: Partial<Draft> = {};
    if (pick.name && found.name) patch.name = found.name.slice(0, LIMITS.name);
    if (pick.headline && found.headline) patch.headline = found.headline.slice(0, LIMITS.headline);
    if (pick.skills) {
      const have = new Set(draft.skills.map((s) => s.toLowerCase()));
      patch.skills = [...draft.skills, ...found.skills.filter((s) => !have.has(s.toLowerCase()))].slice(0, LIMITS.skills);
    }
    if (pick.experience) {
      const key = (e: { title: string; company: string }) => `${e.title}|${e.company}`.toLowerCase();
      const have = new Set(draft.experience.map(key));
      patch.experience = [...draft.experience, ...found.experience.filter((e) => !have.has(key(e)))].slice(0, LIMITS.experience);
    }
    if (pick.education) {
      const key = (e: { school: string; degree: string }) => `${e.school}|${e.degree}`.toLowerCase();
      const have = new Set(draft.education.map(key));
      patch.education = [...draft.education, ...found.education.filter((e) => !have.has(key(e)))].slice(0, LIMITS.education);
    }
    set(patch);
    setFound(null);
    toast('Applied. Review each field, then save.');
  };

  return (
    <div className="flex flex-col gap-12">
      <FileDrop
        label={busy ? 'Reading your resume…' : 'Start from your resume'}
        hint="PDF, up to 10 MB. We pre-fill what we find. You review everything. Your resume stays private."
        accept="application/pdf,.pdf"
        maxBytes={10 * 1024 * 1024}
        onFile={onFile}
        disabled={busy}
        buttonLabel="Upload PDF"
      />
      {error && <p role="alert" className="text-meta text-text">{error}</p>}
      {found && (
        <div role="region" aria-label="Resume suggestions" className={blockClass}>
          <p className="text-body font-medium text-text">Here's what we found. Nothing is saved until you apply it and save.</p>
          <div className="flex flex-col gap-8">
            {found.name && <Checkbox label={`Name: ${found.name}`} checked={pick.name} onChange={(e) => setPick({ ...pick, name: e.target.checked })} />}
            {found.headline && <Checkbox label={`Headline: ${found.headline}`} checked={pick.headline} onChange={(e) => setPick({ ...pick, headline: e.target.checked })} />}
            {found.skills.length > 0 && <Checkbox label={`${found.skills.length} skills: ${found.skills.slice(0, 6).join(', ')}${found.skills.length > 6 ? '…' : ''}`} checked={pick.skills} onChange={(e) => setPick({ ...pick, skills: e.target.checked })} />}
            {found.experience.length > 0 && <Checkbox label={`${found.experience.length} experience ${found.experience.length === 1 ? 'entry' : 'entries'}`} checked={pick.experience} onChange={(e) => setPick({ ...pick, experience: e.target.checked })} />}
            {found.education.length > 0 && <Checkbox label={`${found.education.length} education ${found.education.length === 1 ? 'entry' : 'entries'}`} checked={pick.education} onChange={(e) => setPick({ ...pick, education: e.target.checked })} />}
            {!found.name && !found.headline && found.skills.length === 0 && found.experience.length === 0 && <p className="text-meta text-text-dim">We couldn't find anything useful in that file.</p>}
          </div>
          <div className="flex gap-8"><Button onClick={apply}>Apply selected</Button><Button variant="ghost" onClick={() => setFound(null)}>Dismiss</Button></div>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- Steps */

export const BasicsStep: React.FC<StepProps> = ({ draft, set, errors, uid }) => {
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const onAvatar = async (file: File) => {
    setUploading(true);
    setAvatarError(null);
    try {
      set({ avatarUrl: await uploadPublicImage('avatars', uid, file) });
    } catch (err) {
      setAvatarError(errorMessage(err, "We couldn't upload that image. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-32">
      <ResumePanel uid={uid} draft={draft} set={set} />

      <section aria-label="Profile picture" className="flex items-start gap-16">
        <Avatar src={draft.avatarUrl || undefined} name={draft.name || 'You'} size="xl" />
        <div className="flex-1 flex flex-col gap-8">
          <FileDrop label="Profile picture" hint="JPG, PNG or WebP, up to 5 MB. Without one we show your initials." accept="image/png,image/jpeg,image/webp" maxBytes={5 * 1024 * 1024} onFile={onAvatar} disabled={uploading} buttonLabel={uploading ? 'Uploading…' : 'Upload image'} />
          {avatarError && <p role="alert" className="text-meta text-text">{avatarError}</p>}
          {draft.avatarUrl && <button type="button" onClick={() => set({ avatarUrl: '' })} className="self-start text-meta text-text-dim hover:text-text underline underline-offset-4 rounded-sm">Remove picture</button>}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-24">
        <Field label="Full name" required error={errors.name}><Input value={draft.name} maxLength={LIMITS.name} autoComplete="name" onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Headline" required error={errors.headline} hint="Shown under your name in search. For example: Senior React developer."><Input value={draft.headline} maxLength={LIMITS.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
      </div>

      <Field label="Bio" required error={errors.bio} hint={`${draft.bio.length} / ${LIMITS.bio}`}>
        <Textarea rows={6} value={draft.bio} maxLength={LIMITS.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Your background, what you're best at, and how you like to work." />
      </Field>
    </div>
  );
};

export const SkillsStep: React.FC<StepProps> = ({ draft, set, errors, skillSuggestions }) => (
  <div className="flex flex-col gap-32">
    <Field label="Skills" required error={errors.skills} hint={`Press Enter to add. ${draft.skills.length} / ${LIMITS.skills}`}>
      <TagInput values={draft.skills} onChange={(skills) => set({ skills })} placeholder="e.g. React" max={LIMITS.skills} suggestions={skillSuggestions} />
    </Field>

    <fieldset className="border-0 p-0 m-0">
      <legend className="text-meta font-medium text-text mb-8">Hourly rate</legend>
      <div className="grid grid-cols-rate-row gap-8 items-start max-w-form">
        <Field label="Minimum" error={errors.rateMin}><Input type="number" min={1} inputMode="numeric" className="font-mono" value={draft.rateMin} onChange={(e) => set({ rateMin: e.target.value })} /></Field>
        <span className="pt-40 text-text-dim" aria-hidden="true">–</span>
        <Field label="Maximum" error={errors.rateMax}><Input type="number" min={1} inputMode="numeric" className="font-mono" value={draft.rateMax} onChange={(e) => set({ rateMax: e.target.value })} /></Field>
        <Field label="Currency"><Select value={draft.currency} onChange={(e) => set({ currency: e.target.value })}><option>USD</option><option>EUR</option><option>GBP</option></Select></Field>
      </div>
    </fieldset>

    <div className="grid md:grid-cols-2 gap-24">
      <Field label="Availability">
        <Select value={draft.availability} onChange={(e) => set({ availability: e.target.value as Draft['availability'] })}>
          {AVAILABILITY_OPTIONS.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
        </Select>
      </Field>
      {draft.availability === 'offline' && (
        <Field label="Back on (optional)"><Input type="date" value={draft.backOn} onChange={(e) => set({ backOn: e.target.value })} /></Field>
      )}
      <Field label="Time zone">
        <Select value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })}>
          {(TIMEZONES.includes(draft.timezone) ? TIMEZONES : [draft.timezone, ...TIMEZONES]).map((tz) => (<option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>))}
        </Select>
      </Field>
    </div>

    <Field label="Languages" hint="Press Enter to add.">
      <TagInput values={draft.languages} onChange={(languages) => set({ languages })} placeholder="e.g. English" max={LIMITS.languages} />
    </Field>
  </div>
);

export const ExperienceStep: React.FC<StepProps> = ({ draft, set }) => {
  const upExp = (i: number, patch: Partial<Draft['experience'][number]>) => set({ experience: draft.experience.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const upEdu = (i: number, patch: Partial<Draft['education'][number]>) => set({ education: draft.education.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const yearInput = (v: string) => (v ? Number(v) : undefined);

  return (
    <div className="flex flex-col gap-32">
      <section aria-labelledby="exp-title" className="flex flex-col gap-12">
        <h2 id="exp-title" className="text-body font-semibold text-text">Experience</h2>
        {draft.experience.map((e, i) => (
          <div key={i} className={blockClass} role="group" aria-label={`Experience ${i + 1}`}>
            <div className="grid md:grid-cols-2 gap-12">
              <Field label="Title"><Input value={e.title} maxLength={100} onChange={(ev) => upExp(i, { title: ev.target.value })} /></Field>
              <Field label="Company"><Input value={e.company} maxLength={100} onChange={(ev) => upExp(i, { company: ev.target.value })} /></Field>
              <Field label="Start year"><Input type="number" className="font-mono" value={e.startYear ?? ''} onChange={(ev) => upExp(i, { startYear: Number(ev.target.value) || new Date().getFullYear() })} /></Field>
              <Field label="End year" hint="Leave blank if current."><Input type="number" className="font-mono" value={e.endYear ?? ''} onChange={(ev) => upExp(i, { endYear: yearInput(ev.target.value) })} /></Field>
            </div>
            <Field label="What you did (optional)"><Textarea rows={2} maxLength={240} value={e.description ?? ''} onChange={(ev) => upExp(i, { description: ev.target.value })} className="min-h-0" /></Field>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => set({ experience: draft.experience.filter((_, idx) => idx !== i) })}><Trash2 className="w-16 h-16" aria-hidden="true" />Remove</Button>
          </div>
        ))}
        {draft.experience.length < LIMITS.experience && (
          <Button variant="secondary" className="self-start" onClick={() => set({ experience: [...draft.experience, { title: '', company: '', startYear: new Date().getFullYear() }] })}><Plus className="w-16 h-16" aria-hidden="true" />Add experience</Button>
        )}
      </section>

      <section aria-labelledby="edu-title" className="flex flex-col gap-12">
        <h2 id="edu-title" className="text-body font-semibold text-text">Education</h2>
        {draft.education.map((e, i) => (
          <div key={i} className={blockClass} role="group" aria-label={`Education ${i + 1}`}>
            <div className="grid md:grid-cols-2 gap-12">
              <Field label="School"><Input value={e.school} maxLength={100} onChange={(ev) => upEdu(i, { school: ev.target.value })} /></Field>
              <Field label="Degree"><Input value={e.degree} maxLength={100} onChange={(ev) => upEdu(i, { degree: ev.target.value })} /></Field>
              <Field label="Start year"><Input type="number" className="font-mono" value={e.startYear ?? ''} onChange={(ev) => upEdu(i, { startYear: yearInput(ev.target.value) })} /></Field>
              <Field label="End year"><Input type="number" className="font-mono" value={e.endYear ?? ''} onChange={(ev) => upEdu(i, { endYear: yearInput(ev.target.value) })} /></Field>
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => set({ education: draft.education.filter((_, idx) => idx !== i) })}><Trash2 className="w-16 h-16" aria-hidden="true" />Remove</Button>
          </div>
        ))}
        {draft.education.length < LIMITS.education && (
          <Button variant="secondary" className="self-start" onClick={() => set({ education: [...draft.education, { school: '', degree: '' }] })}><Plus className="w-16 h-16" aria-hidden="true" />Add education</Button>
        )}
      </section>
    </div>
  );
};

export const PortfolioStep: React.FC<StepProps> = ({ draft, set, errors, uid }) => {
  const { toast } = useToast();
  const up = (i: number, patch: Partial<Draft['portfolio'][number]>) => set({ portfolio: draft.portfolio.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  const uploadFor = async (i: number, file: File) => {
    try {
      up(i, { imageUrl: await uploadPublicImage('portfolio', uid, file) });
    } catch (err) {
      toast(errorMessage(err, "We couldn't upload that image."));
    }
  };

  return (
    <div className="flex flex-col gap-32">
      <Field label="Portfolio or LinkedIn link" error={errors.portfolioUrl} hint="Used by the Bench team when verifying profiles.">
        <Input type="url" placeholder="https://" value={draft.portfolioUrl} onChange={(e) => set({ portfolioUrl: e.target.value })} />
      </Field>

      <section aria-labelledby="gallery-title" className="flex flex-col gap-12">
        <h2 id="gallery-title" className="text-body font-semibold text-text">Portfolio gallery <span className="text-text-dim font-normal">(up to {LIMITS.portfolio})</span></h2>
        {draft.portfolio.map((p, i) => (
          <div key={i} className={blockClass} role="group" aria-label={`Portfolio item ${i + 1}`}>
            <div className="grid md:grid-cols-2 gap-12">
              <Field label="Title"><Input value={p.title} maxLength={80} onChange={(e) => up(i, { title: e.target.value })} /></Field>
              <Field label="Link" error={errors[`portfolio.${i}.link`]}><Input type="url" placeholder="https://" value={p.link} onChange={(e) => up(i, { link: e.target.value })} /></Field>
            </div>
            <Field label="One-line description"><Input value={p.description ?? ''} maxLength={140} onChange={(e) => up(i, { description: e.target.value })} /></Field>
            <div className="flex items-center gap-12 flex-wrap">
              {p.imageUrl && <img src={p.imageUrl} alt="" className="w-64 h-48 rounded-sm object-cover border border-border" />}
              <FileDrop label={p.imageUrl ? 'Replace image' : 'Add an image (optional)'} accept="image/png,image/jpeg,image/webp" maxBytes={5 * 1024 * 1024} onFile={(f) => uploadFor(i, f)} buttonLabel="Choose image" />
            </div>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => set({ portfolio: draft.portfolio.filter((_, idx) => idx !== i) })}><Trash2 className="w-16 h-16" aria-hidden="true" />Remove</Button>
          </div>
        ))}
        {draft.portfolio.length < LIMITS.portfolio && (
          <Button variant="secondary" className="self-start" onClick={() => set({ portfolio: [...draft.portfolio, { title: '', link: '' }] })}><Plus className="w-16 h-16" aria-hidden="true" />Add item</Button>
        )}
      </section>
    </div>
  );
};
