import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { TagInput } from '@/components/ui/TagInput';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import { createProject } from '@/lib/data/projects';

export const NewProjectPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [skills, setSkills] = React.useState<string[]>([]);
  const [min, setMin] = React.useState('');
  const [max, setMax] = React.useState('');
  const [timeline, setTimeline] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (title.trim().length < 5) found.title = 'Give the project a title of at least 5 characters.';
    if (description.trim().length < 30) found.description = 'Describe the work in at least 30 characters.';
    if (skills.length === 0) found.skills = 'Add at least one skill.';
    const lo = Number(min);
    const hi = Number(max);
    if (!lo || lo <= 0) found.min = 'Enter a minimum hourly budget.';
    if (!hi || hi < lo) found.max = 'Maximum must be at least the minimum.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const id = await createProject(currentUser!.uid, currentUser!.displayName ?? 'A client', {
        title: title.trim(), description: description.trim(), skills, budgetMin: lo, budgetMax: hi, timeline: timeline.trim(),
      });
      toast('Project posted.');
      navigate(`/projects/${id}`);
    } catch (err) {
      toast(errorMessage(err, "We couldn't post that project. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Page title="New project" width="form">
      <PageHeader title="New project" />
      <form onSubmit={submit} noValidate className="bg-surface border border-border rounded-lg p-24 sm:p-32 flex flex-col gap-24">
        <Field label="Title" required error={errors.title}><Input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Description" required error={errors.description} hint={`${description.length} / 3000`}><Textarea rows={7} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Skills" required error={errors.skills} hint="Press Enter to add."><TagInput values={skills} onChange={setSkills} placeholder="e.g. React" max={12} /></Field>
        <div className="grid sm:grid-cols-3 gap-16">
          <Field label="Min budget ($/hr)" required error={errors.min}><Input type="number" min={1} className="font-mono" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Max budget ($/hr)" required error={errors.max}><Input type="number" min={1} className="font-mono" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
          <Field label="Timeline"><Input value={timeline} maxLength={40} placeholder="e.g. 6 weeks" onChange={(e) => setTimeline(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => navigate('/projects')}>Cancel</Button><Button type="submit" loading={busy}>Post project</Button></div>
      </form>
    </Page>
  );
};
