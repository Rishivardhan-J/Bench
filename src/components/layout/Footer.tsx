import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-border bg-bg py-24 mt-auto">
      <div className="max-w-[1280px] mx-auto px-24 flex flex-col sm:flex-row items-center justify-between gap-16 text-[13px] text-text-mute">
        <div>&copy; {new Date().getFullYear()} Bench. All rights reserved.</div>
        <div className="flex gap-24">
          <Link to="/for-freelancers" className="hover:text-text transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm">For Freelancers</Link>
          <Link to="/privacy" className="hover:text-text transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm">Privacy</Link>
          <Link to="/terms" className="hover:text-text transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm">Terms</Link>
        </div>
      </div>
    </footer>
  );
};
