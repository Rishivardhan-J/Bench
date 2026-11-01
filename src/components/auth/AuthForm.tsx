import React from 'react';
import { useAuth } from '@/lib/providers/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { getAuthErrorMessage } from '@/lib/utils/error';

interface AuthFormProps {
  role: 'client' | 'freelancer';
  initialMode?: 'signin' | 'signup';
  onSuccess: (uid: string) => void;
  /** Autofocus the first field (used inside dialogs). */
  autoFocus?: boolean;
}

export const AuthForm: React.FC<AuthFormProps> = ({ role, initialMode = 'signin', onSuccess, autoFocus }) => {
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = React.useState(initialMode);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => setMode(initialMode), [initialMode]);

  const isSignUp = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Please enter both email and password.');
    if (isSignUp && !name.trim()) return setError('Please tell us your name.');
    setLoading(true);
    setError(null);
    try {
      const user = isSignUp ? await signUp(email.trim(), password, role, name.trim()) : await signIn(email.trim(), password);
      onSuccess(user.uid);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return setError('Enter your email first, then choose "Forgot password".');
    try {
      await resetPassword(email.trim());
      setError(null);
      toast('If that email has an account, a reset link is on its way.');
    } catch (err) {
      setError(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-16" noValidate>
      {error && (
        <div role="alert" className="p-12 bg-surface-2 border border-border-strong text-meta text-text rounded-sm">
          {error}
        </div>
      )}

      {isSignUp && (
        <Field label={role === 'freelancer' ? 'Full name' : 'Your name'} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus={autoFocus}
            maxLength={80}
            placeholder="Jane Doe"
          />
        </Field>
      )}
      <Field label="Email" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus={autoFocus && !isSignUp}
          placeholder="you@company.com"
        />
      </Field>
      <Field label="Password" required hint={isSignUp ? '6 or more characters.' : undefined}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          placeholder="Password"
        />
      </Field>

      <Button type="submit" size="lg" loading={loading} className="w-full mt-8">
        {loading ? 'Please wait' : isSignUp ? 'Create account' : 'Sign in'}
      </Button>

      <div className="flex items-center justify-between gap-16 text-meta">
        <button type="button" onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); }} className="text-text-dim hover:text-text rounded-sm">
          {isSignUp ? 'Already have an account? Sign in' : "New here? Create an account"}
        </button>
        {!isSignUp && (
          <button type="button" onClick={forgot} className="text-text-dim hover:text-text rounded-sm">
            Forgot password?
          </button>
        )}
      </div>
    </form>
  );
};
