import React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useShortlist } from '@/lib/providers/ShortlistContext';

/** The list picker, opened from any save button once a freelancer is already saved. */
export const SaveToListDialog: React.FC = () => {
  const { pickerFor, closePicker, lists, addToList, removeFromList, createList } = useShortlist();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const toggle = async (listId: string, checked: boolean) => {
    if (!pickerFor) return;
    try {
      if (checked) await addToList(listId, pickerFor);
      else await removeFromList(listId, pickerFor);
    } catch {
      toast("Couldn't update that list. Please try again.");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickerFor || !name.trim()) return;
    setBusy(true);
    try {
      await createList(name, pickerFor);
      setName('');
      toast(`Saved to ${name.trim()}`);
    } catch {
      toast("Couldn't create that list. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={pickerFor !== null} onClose={closePicker} title="Save to lists" description="Choose which lists include this freelancer.">
      <fieldset className="flex flex-col gap-12 mb-24 border-0 p-0 m-0">
        <legend className="sr-only">Your lists</legend>
        {lists.map((l) => (
          <Checkbox
            key={l.id}
            label={`${l.name} (${l.items.length})`}
            checked={l.items.some((i) => i.freelancerId === pickerFor)}
            onChange={(e) => toggle(l.id, e.target.checked)}
          />
        ))}
      </fieldset>
      <form onSubmit={create} className="flex gap-8 mb-24">
        <Input aria-label="New list name" placeholder="New list name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button type="submit" variant="secondary" loading={busy} disabled={!name.trim()}>Create</Button>
      </form>
      <div className="flex justify-end"><Button onClick={closePicker}>Done</Button></div>
    </Dialog>
  );
};
