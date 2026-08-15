import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/providers/AuthContext';
import { Button } from './Button';
import { Input } from './Input';
import { X } from 'lucide-react';

export const SignInModal: React.FC = () => {
  const { isSignInModalOpen, closeSignInModal, signIn, signUp } = useAuth();
  
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
        setError("That email is already registered. If you have a freelancer account, you must use a different email to sign up as a hirer.");
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
