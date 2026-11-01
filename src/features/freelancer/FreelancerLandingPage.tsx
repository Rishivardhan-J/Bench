import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/providers/AuthContext';

const STEPS = [
  { title: 'Upload your resume', body: 'We read it and pre-fill your skills and experience. You review and edit every field.' },
  { title: 'Add rate and availability', body: 'Set your hourly range, timezone and when you can start. Change them any time.' },
  { title: 'Get reviewed, then discovered', body: 'The Bench team approves each profile. Once live, clients can find and contact you.' },
];

export const FreelancerLandingPage: React.FC = () => {
  const { currentUser, role, isAuthLoading, signOut } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isAuthLoading && currentUser && role === 'freelancer') navigate('/freelancer/profile', { replace: true });
  }, [isAuthLoading, currentUser, role, navigate]);

  const wrongRole = !isAuthLoading && currentUser && role !== 'freelancer';

  return (
    <Page title="For freelancers" width="page">
      <div className="grid lg:grid-cols-2 gap-48 items-start">
        <div>
          <h1 className="text-hero text-text mb-16">Be found for the right work.</h1>
          <p className="text-body text-text-dim max-w-prose mb-32">
            Build a credible profile in minutes, control who can contact you, and let clients come to you. Bench is free for freelancers.
          </p>
          <ol className="flex flex-col gap-20">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-16">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-32 h-32 rounded-full border border-border-strong font-mono tabular-nums text-meta text-text">{i + 1}</span>
                <div>
                  <h2 className="text-body font-semibold text-text">{s.title}</h2>
                  <p className="text-body text-text-dim">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-surface border border-border rounded-lg p-24 sm:p-32">
          {wrongRole ? (
            <div role="status" className="flex flex-col gap-16">
              <h2 className="text-section-heading text-text">You're signed in as a client</h2>
              <p className="text-body text-text-dim">
                A client account and a freelancer account can't share an email. Sign out, then use a different email to join as a freelancer.
              </p>
              <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>
            </div>
          ) : (
            <>
              <h2 className="text-section-heading text-text mb-24">Create your freelancer profile</h2>
              <AuthForm role="freelancer" initialMode="signup" onSuccess={() => navigate('/freelancer/profile')} />
              <p className="mt-24 pt-16 border-t border-border text-meta text-text-dim">
                Hiring instead? <Link to="/" className="text-text underline underline-offset-4">Find freelancers</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </Page>
  );
};
