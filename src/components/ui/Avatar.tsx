import React from 'react';
import { initials } from '@/lib/format';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'w-24 h-24 text-10',
  md: 'w-32 h-32 text-meta',
  lg: 'w-48 h-48 text-body',
  xl: 'w-64 h-64 text-section-heading',
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const [failed, setFailed] = React.useState(false);
  const base = `inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-surface-3 ${sizes[size]} ${className}`;

  if (src && !failed) {
    return (
      <span className={base}>
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <span className={`${base} text-text-dim font-medium`} aria-hidden="true">
      {initials(name)}
    </span>
  );
};
