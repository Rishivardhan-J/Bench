import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const getInitials = (n: string) => {
    const parts = n.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.substring(0, 2).toUpperCase();
  };

  const sizes = {
    sm: 'w-24 h-24 text-10',
    md: 'w-32 h-32 text-meta',
    lg: 'w-48 h-48 text-body'
  };

  const baseStyles = 'inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0';

  if (src) {
    return (
      <div className={`${baseStyles} ${sizes[size]} ${className}`}>
        <img src={src} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${baseStyles} bg-surface-3 text-text-dim font-medium ${sizes[size]} ${className}`}>
      {getInitials(name)}
    </div>
  );
};
