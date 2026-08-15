import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/providers/AuthContext';
import { useShortlist } from '@/lib/providers/ShortlistContext';
import { DemoFreelancerProvider } from '@/lib/providers/freelancer-provider';
import { ResultsTable } from '@/features/search/components/ResultsTable';
import type { Freelancer } from '@/types';
import { EmptyState } from '@/components/ui/States';

const provider = new DemoFreelancerProvider();

export const ShortlistsPage: React.FC = () => {
  const { currentUser, isAuthLoading, openSignInModal } = useAuth();
  const { shortlisted } = useShortlist();
  const [data, setData] = useState<Freelancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // If auth finishes loading and user is not signed in, open modal immediately
    if (!isAuthLoading && !currentUser) {
      openSignInModal();
    }
  }, [isAuthLoading, currentUser, openSignInModal]);

  useEffect(() => {
    if (isAuthLoading || !currentUser) {
      setIsLoading(true);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setIsError(false);
      try {
        const promises = Array.from(shortlisted).map(id => provider.getById(id));
        const results = await Promise.all(promises);
        setData(results.filter(Boolean) as Freelancer[]);
      } catch (err) {
        console.error(err);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [shortlisted, currentUser, isAuthLoading]);

  // Handle protected route bounce
  if (!isAuthLoading && !currentUser) {
    return <Navigate to="/" replace />;
  }

  if (isAuthLoading) {
    // Minimal wait state while checking auth
    return <div className="max-w-[1280px] mx-auto px-24 py-48 text-text-mute">Loading...</div>;
  }

  return (
    <div className="max-w-[1280px] mx-auto px-24 py-48">
      <div className="flex items-center justify-between mb-32">
        <h1 className="text-section-heading text-text font-semibold">Your Shortlists</h1>
      </div>

      {shortlisted.size === 0 && !isLoading ? (
        <div className="py-64 flex justify-center">
          <EmptyState 
            message="You haven't shortlisted anyone yet." 
            actionLabel="Go to search"
            onAction={() => window.location.href = '/'}
          />
        </div>
      ) : (
        <ResultsTable 
          data={data}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {}} // No-op since we reactively reload on `shortlisted`
          onClearFilters={() => {}}
          sortField="rating" // Hardcoded sort for simplicity as per spec
          sortDirection="desc"
          onChangeSort={() => {}} // Sorting not strictly required on this page, but passing to satisfy props
          reasoningData={{}}
        />
      )}
    </div>
  );
};
