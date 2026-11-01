import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import { sendConnectRequest } from '@/lib/data/messaging';
import { useMyProjects } from '@/lib/data/projects';
import { detectOffPlatform, OFF_PLATFORM_COPY } from '@/lib/offPlatform';

interface ConnectDialogProps {
  open: boolean;
  onClose: () => void;
  freelancerUid: string;
  freelancerName: string;
}

export const ConnectDialog: React.FC<ConnectDialogProps> = ({ open, onClose, freelancerUid, freelancerName }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { data: projects } = useMyProjects(open && currentUser ? currentUser.uid : null);
  const [message, setMessage] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const openProjects = projects.filter((p) => p.status === 'open');
  const warning = detectOffPlatform(message);
  const tooShort = message.trim().length < 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tooShort) return setError('Write a sentence or two so they know what you need.');
    setSending(true);
    setError(null);
    try {
      await sendConnectRequest({ freelancerUid, message: message.trim(), projectId: projectId || undefined });
      toast(`Request sent to ${freelancerName}. You'll be notified when they reply.`);
      setMessage('');
      setProjectId('');
      onClose();
    } catch (err) {
      setError(errorMessage(err, "We couldn't send that request. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Connect with ${freelancerName}`} description="Introduce yourself and what you need. They can accept or decline.">
      <form onSubmit={submit} className="flex flex-col gap-16" noValidate>
        {error && <div role="alert" className="p-12 bg-surface-2 border border-border-strong text-meta text-text rounded-sm">{error}</div>}

        <Field label="Message" required hint={`${message.length} / 1000`}>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={5}
            autoFocus
            placeholder="Hi! We're building… and need help with… Our timeline is…"
          />
        </Field>

        {warning && (
          <p role="status" className="flex gap-8 p-12 rounded-sm bg-surface-2 border border-border text-meta text-text-dim">
            <AlertTriangle className="w-16 h-16 flex-shrink-0 mt-2" aria-hidden="true" />
            {OFF_PLATFORM_COPY[warning]}
          </p>
        )}

        {openProjects.length > 0 && (
          <Field label="Attach a project (optional)">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {openProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex justify-end gap-8">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={sending}>Send request</Button>
        </div>
      </form>
    </Dialog>
  );
};
