import React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { submitReport } from '@/lib/data/profile';
import { errorMessage } from '@/lib/data/api';

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: 'profile' | 'message';
  targetId: string;
  label: string;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({ open, onClose, targetType, targetId, label }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (reason.trim().length < 3) return setError('Tell us briefly what is wrong.');
    setSending(true);
    setError(null);
    try {
      await submitReport({ reporterUid: currentUser.uid, targetType, targetId, reason: reason.trim() });
      toast('Thanks. The Bench team will take a look.');
      setReason('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Report ${label}`} description="Reports go to the Bench team. The person is not told who reported them.">
      <form onSubmit={submit} className="flex flex-col gap-16" noValidate>
        {error && <div role="alert" className="p-12 bg-surface-2 border border-border-strong text-meta text-text rounded-sm">{error}</div>}
        <Field label="What happened?" required hint={`${reason.length} / 500`}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} autoFocus />
        </Field>
        <div className="flex justify-end gap-8">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={sending}>Send report</Button>
        </div>
      </form>
    </Dialog>
  );
};
