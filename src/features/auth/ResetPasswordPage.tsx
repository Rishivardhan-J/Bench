import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page, PageHeader } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/providers/AuthContext';
import { api, errorMessage } from '@/lib/data/api';

/** Where the link in a password reset email lands. */
export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { openSignInModal } = useAuth();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("Those passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-confirm', { token, password });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "We couldn't reset your password. Request a new link and try again."));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Page title="Password updated" width="auth">
        <PageHeader title="Password updated" description="You've been signed out everywhere. Sign in with your new password." />
        <Button onClick={() => { navigate('/'); openSignInModal({ mode: 'signin' }); }}>Sign in</Button>
      </Page>
    );
  }

  return (
    <Page title="Choose a new password" width="auth">
      <PageHeader title="Choose a new password" />
      {!token ? (
        <p className="text-body text-text-dim">This link is missing its token. Open the link from your email again, or <ButtonLink to="/" variant="ghost">go back to search</ButtonLink>.</p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-16">
          {error && <div role="alert" className="p-12 bg-surface-2 border border-border-strong text-meta text-text rounded-sm">{error}</div>}
          <Field label="New password" required hint="8 or more characters."><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
          <Field label="Confirm new password" required><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          <Button type="submit" loading={busy}>Update password</Button>
        </form>
      )}
    </Page>
  );
};
