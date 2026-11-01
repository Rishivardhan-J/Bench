import React from 'react';
import { Bookmark } from 'lucide-react';
import { useShortlist } from '@/lib/providers/ShortlistContext';

interface SaveButtonProps {
  id: string;
  name: string;
  variant?: 'icon' | 'framed';
}

/** One save control everywhere. Pressed means "in at least one of your lists". */
export const SaveButton: React.FC<SaveButtonProps> = ({ id, name, variant = 'icon' }) => {
  const { isSaved, requestSave } = useShortlist();
  const saved = isSaved(id);
  const frame = variant === 'framed' ? `border ${saved ? 'bg-surface-2 border-border-strong' : 'bg-surface border-border'} w-44 h-44` : 'w-32 h-32';
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Save ${name} to a shortlist`}
      title={saved ? 'Saved. Manage lists' : 'Save to a shortlist'}
      onClick={(e) => {
        e.stopPropagation();
        requestSave(id);
      }}
      className={`relative z-10 inline-flex items-center justify-center rounded-md transition duration-120 active:scale-97 hover:bg-surface-3 ${frame} ${
        saved ? 'text-accent-text' : 'text-text-dim hover:text-text'
      }`}
    >
      <Bookmark className="w-16 h-16" fill={saved ? 'currentColor' : 'none'} strokeWidth={2} aria-hidden="true" />
    </button>
  );
};
