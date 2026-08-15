import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/providers/AuthContext';
import { Button } from './Button';
import { Input } from './Input';
import { X } from 'lucide-react';

export const SignInModal: React.FC = () => {
  const { isSignInModalOpen, closeSignInModal, signIn, signUp, signInWithGoogle } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isSignInModalOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      
      // Auto focus the first input if available
      setTimeout(() => {
        const firstInput = modalRef.current?.querySelector('input');
        if (firstInput) firstInput.focus();
      }, 50);
    } else {
      document.body.style.overflow = 'unset';
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSignInModalOpen) return;
      if (e.key === 'Escape') closeSignInModal();
      
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;
        
        if (!focusableElements || focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    if (isSignInModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSignInModalOpen, closeSignInModal]);

  if (!isSignInModalOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      closeSignInModal();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("That email is already in use. Try signing in instead.");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else {
        setError("Authentication failed. Please check your details and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      closeSignInModal();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Google sign-in was cancelled.");
      } else {
        setError("Failed to sign in with Google. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm transition-opacity" 
        onClick={closeSignInModal}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-surface border border-border shadow-lg rounded-lg w-full max-w-[400px] p-32 m-16 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button 
          onClick={closeSignInModal}
          className="absolute top-16 right-16 p-8 text-text-mute hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm transition-colors"
          aria-label="Close modal"
        >
          <X className="w-16 h-16" />
        </button>

        <div className="mb-24">
          <h2 id="modal-title" className="text-[20px] font-semibold text-text mb-8">
            {isSignUp ? 'Create an account' : 'Sign in to Bench'}
          </h2>
          <p className="text-body text-text-dim">
            {isSignUp ? 'Join to save freelancers to your shortlist.' : 'Welcome back! Please enter your details.'}
          </p>
        </div>

        {error && (
          <div className="mb-24 p-12 bg-surface-2 border border-border text-meta text-text rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-16 mb-24">
          <div className="flex flex-col gap-8">
            <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="email">Email</label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Enter your email" 
              required
            />
          </div>
          <div className="flex flex-col gap-8">
            <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="password">Password</label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required
            />
          </div>
          
          <Button variant="primary" type="submit" className="w-full mt-8" disabled={isLoading}>
            {isLoading ? 'Please wait...' : (isSignUp ? 'Create account' : 'Sign in')}
          </Button>
        </form>

        <div className="relative mb-24">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-meta">
            <span className="bg-surface px-8 text-text-mute">Or continue with</span>
          </div>
        </div>

        <Button 
          variant="secondary" 
          className="w-full flex items-center justify-center gap-8" 
          onClick={handleGoogleAuth}
          disabled={isLoading}
        >
          <svg className="w-16 h-16" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Google
        </Button>

        <div className="mt-24 text-center">
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-meta text-text-dim hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};
