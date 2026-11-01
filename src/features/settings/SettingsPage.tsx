import React from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { errorMessage } from '@/lib/data/api';
import { DEFAULT_PREFS, savePrefs, useNotificationPrefs } from '@/lib/data/notifications';
import { deleteAccount } from '@/lib/data/profile';
import { deleteSavedSearch, setSearchAlert, useSavedSearches } from '@/lib/data/projects';
import type { NotificationPrefs } from '@/types';

const PREF_LABELS: Record<keyof NotificationPrefs, string> = {
  new_request: 'New connect requests',
  request_accepted: 'Accepted requests',
  new_message: 'New messages',
  proposal_received: 'Proposals on your projects',
};

export const SettingsPage: React.FC = () => {
  const { currentUser, role, signOut, resetPassword } = useAuth();
  const { toast } = useToast();
  const uid = currentUser!.uid;
  const prefs = useNotificationPrefs(uid);
  const searches = useSavedSearches(role === 'client' ? uid : null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const keys = (role === 'client'
    ? ['request_accepted', 'new_message', 'proposal_received']
    : ['new_request', 'new_message']) as (keyof NotificationPrefs)[];

  const toggle = async (key: keyof NotificationPrefs, channel: 'inApp' | 'email', value: boolean) => {
    const next = { ...DEFAULT_PREFS, ...prefs.data, [key]: { ...prefs.data[key], [channel]: value } };
    try {
      await savePrefs(uid, next);
    } catch {
      toast("Couldn't save that preference.");
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAccount({});
      await signOut().catch(() => undefined);
      window.location.assign('/');
    } catch (err) {
      toast(errorMessage(err, "We couldn't delete your account. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Page title="Settings" width="narrow">
      <PageHeader title="Settings" description={currentUser?.email ?? undefined} />

      <section aria-labelledby="notif-title" className="mb-40">
        <h2 id="notif-title" className="text-body font-semibold text-text mb-4">Notifications</h2>
        <p className="text-meta text-text-dim mb-16">Choose how you hear about activity.</p>
        <table className="w-full border border-border rounded-lg bg-surface">
          <thead>
            <tr className="text-meta text-text-dim border-b border-border">
              <th scope="col" className="text-left font-medium p-12">Type</th>
              <th scope="col" className="font-medium p-12 w-96">In app</th>
              <th scope="col" className="font-medium p-12 w-96">Email</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-b border-border last:border-b-0">
                <th scope="row" className="text-left font-normal text-body text-text p-12">{PREF_LABELS[k]}</th>
                {(['inApp', 'email'] as const).map((ch) => (
                  <td key={ch} className="p-12 text-center">
                    <input
                      type="checkbox"
                      className="w-16 h-16 accent-white"
                      aria-label={`${PREF_LABELS[k]}, ${ch === 'inApp' ? 'in app' : 'email'}`}
                      checked={prefs.data[k]?.[ch] ?? true}
                      onChange={(e) => toggle(k, ch, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {role === 'client' && (
        <section id="saved-searches" aria-labelledby="saved-title" className="mb-40 scroll-mt-80">
          <h2 id="saved-title" className="text-body font-semibold text-text mb-16">Saved searches</h2>
          {searches.data.length === 0 ? (
            <EmptyState message="No saved searches. Save one from the search page to get an alert when new people match." />
          ) : (
            <ul className="border border-border rounded-lg bg-surface">
              {searches.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-12 p-12 border-b border-border last:border-b-0">
                  <Link to={`/?${new URLSearchParams({ q: s.query }).toString()}`} className="flex-1 min-w-120 text-body text-text hover:underline underline-offset-4 rounded-sm">{s.label}</Link>
                  <Checkbox label="Email me new matches" checked={s.alertEnabled} onChange={(e) => void setSearchAlert(s.id, e.target.checked)} />
                  <Button variant="ghost" size="sm" onClick={() => void deleteSavedSearch(s.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="account-title" className="mb-40">
        <h2 id="account-title" className="text-body font-semibold text-text mb-16">Account</h2>
        <div className="flex flex-wrap gap-8">
          <Button variant="secondary" onClick={() => currentUser?.email && resetPassword(currentUser.email).then(() => toast('Password reset email sent.')).catch(() => toast("Couldn't send the email."))}>Change password</Button>
          <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </section>

      <section aria-labelledby="danger-title" className="p-24 border border-border-strong rounded-lg">
        <h2 id="danger-title" className="text-body font-semibold text-text mb-4">Delete account</h2>
        <p className="text-meta text-text-dim mb-16 max-w-prose">This permanently removes your profile, messages, shortlists and uploaded files. It cannot be undone.</p>
        <Button variant="secondary" onClick={() => { setTyped(''); setConfirmOpen(true); }}>Delete my account</Button>
      </section>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete your account?" description="Type DELETE to confirm. Everything is removed immediately.">
        <div className="flex flex-col gap-16">
          <Field label="Confirmation"><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus /></Field>
          <div className="flex justify-end gap-8"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button loading={busy} disabled={typed !== 'DELETE'} onClick={remove}>Delete account</Button></div>
        </div>
      </Dialog>
    </Page>
  );
};
