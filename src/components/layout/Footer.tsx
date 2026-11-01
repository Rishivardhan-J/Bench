import React from 'react';
import { Link } from 'react-router-dom';

const link = 'text-text-dim hover:text-text transition-colors duration-120 rounded-sm';

export const Footer: React.FC = () => (
  <footer className="w-full border-t border-border bg-bg py-24 mt-auto">
    <div className="max-w-page mx-auto px-16 sm:px-24 flex flex-col sm:flex-row items-center justify-between gap-16 text-meta text-text-dim">
      <div>&copy; {new Date().getFullYear()} Bench</div>
      <nav aria-label="Footer" className="flex gap-24">
        <Link to="/for-freelancers" className={link}>For freelancers</Link>
        <Link to="/privacy" className={link}>Privacy</Link>
        <Link to="/terms" className={link}>Terms</Link>
      </nav>
    </div>
  </footer>
);
