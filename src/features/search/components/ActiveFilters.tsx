import React from 'react';
import { FilterChip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import type { FilterChip as ChipModel } from '@/lib/search';

interface ActiveFiltersProps {
  chips: ChipModel[];
  onRemove: (key: string) => void;
  onClear: () => void;
  onSave?: () => void;
}

/** Every filter in play, including ones read from the brief, as a removable chip. */
export const ActiveFilters: React.FC<ActiveFiltersProps> = ({ chips, onRemove, onClear, onSave }) => {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-8" role="group" aria-label="Active filters">
      {chips.map((c) => (
        <FilterChip key={c.key} label={c.label} onRemove={() => onRemove(c.key)} />
      ))}
      <Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button>
      {onSave && <Button variant="ghost" size="sm" onClick={onSave}>Save this search</Button>}
    </div>
  );
};
