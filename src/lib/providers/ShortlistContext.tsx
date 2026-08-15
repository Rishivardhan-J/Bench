import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ShortlistContextType {
  shortlisted: Set<string>;
  toggleShortlist: (id: string) => void;
}

const ShortlistContext = createContext<ShortlistContextType | undefined>(undefined);

export const ShortlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  const toggleShortlist = (id: string) => {
    setShortlisted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ShortlistContext.Provider value={{ shortlisted, toggleShortlist }}>
      {children}
    </ShortlistContext.Provider>
  );
};

export const useShortlist = () => {
  const context = useContext(ShortlistContext);
  if (!context) {
    throw new Error('useShortlist must be used within a ShortlistProvider');
  }
  return context;
};
