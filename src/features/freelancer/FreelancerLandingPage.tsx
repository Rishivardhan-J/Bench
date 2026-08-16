import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/providers/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getAuthErrorMessage } from '@/lib/utils/error';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const FreelancerLandingPage: React.FC = () => {
  const { signIn, signUp, currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect to profile
  useEffect(() => {
    if (currentUser) {
      navigate('/freelancer-profile');
    }
  }, [currentUser, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const user = await signUp(email, password);
        // Create initial profile document using the exact UID from the new Auth user
        const docRef = doc(db, 'freelancerProfiles', user.uid);
        await setDoc(docRef, {
          approved: false,
          verified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await signIn(email, password);
      }
      navigate('/freelancer-profile');
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-[600px] mx-auto px-24 pt-64 flex flex-col gap-32">
      <div className="text-center">
        <h1 className="text-[32px] md:text-[40px] font-semibold text-text leading-[1.1] tracking-tight mb-16">
          Join the Bench
        </h1>
        <p className="text-body text-text-dim max-w-[480px] mx-auto">
          Create a profile to be discovered by top teams. We use AI to match your unique skills with the right projects.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-32 shadow-sm mt-16">
        <h2 className="text-[20px] font-semibold text-text mb-24">
          {isSignUp ? 'Create your freelancer profile' : 'Sign in to your account'}
        </h2>
        
        {error && (
          <div className="mb-24 p-12 bg-surface-2 border border-border text-meta text-text rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-16 mb-24">
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
            {isLoading ? 'Please wait...' : (isSignUp ? 'Sign up' : 'Sign in')}
          </Button>
        </form>

        <div className="text-center">
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
