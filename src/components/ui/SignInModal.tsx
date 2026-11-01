import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/providers/AuthContext';
import { Dialog } from './Dialog';
import { AuthForm } from '@/components/auth/AuthForm';

export const SignInModal: React.FC = () => {
  const { isSignInModalOpen, closeSignInModal, completeSignIn, modalOptions } = useAuth();
  const signUp = modalOptions.mode === 'signup';

  return (
    <Dialog
      open={isSignInModalOpen}
      onClose={closeSignInModal}
      title={signUp ? 'Create a client account' : 'Sign in to Bench'}
      description={modalOptions.reason ?? 'Welcome back. Enter your details to continue.'}
    >
      <AuthForm role="client" initialMode={signUp ? 'signup' : 'signin'} onSuccess={completeSignIn} autoFocus />
      <p className="mt-24 pt-16 border-t border-border text-meta text-text-dim">
        Looking for work?{' '}
        <Link to="/for-freelancers" onClick={closeSignInModal} className="text-text underline underline-offset-4">
          Join as a freelancer
        </Link>
      </p>
    </Dialog>
  );
};
