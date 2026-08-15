import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-24 text-center">
      <h1 className="text-[120px] leading-none font-bold text-text-mute mb-24">404</h1>
      <h2 className="text-section-heading text-text mb-16">Page not found</h2>
      <p className="text-body text-text-dim mb-32 max-w-[400px]">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="focus:outline-none rounded-sm">
        <Button variant="primary">Return to search</Button>
      </Link>
    </div>
  );
};
