import React from 'react';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { StatusDot } from '@/components/ui/StatusDot';
import type { Freelancer } from '@/types';

interface FilterRailProps {
  className?: string;
  skills: string[];
  onChangeSkills: (skills: string[]) => void;
  rateMin: number | null;
  onChangeRateMin: (rate: number | null) => void;
  rateMax: number | null;
  onChangeRateMax: (rate: number | null) => void;
  availability: Freelancer['availability'][];
  onChangeAvailability: (availability: Freelancer['availability'][]) => void;
  minRating: number | null;
  onChangeMinRating: (rating: number | null) => void;
  onClearFilters: () => void;
}

export const FilterRail: React.FC<FilterRailProps> = ({ 
  className = '',
  skills,
  onChangeSkills,
  rateMin,
  onChangeRateMin,
  rateMax,
  onChangeRateMax,
  availability,
  onChangeAvailability,
  minRating,
  onChangeMinRating,
  onClearFilters
}) => {

  const allSkills = ['Figma', 'UI/UX', 'React', 'Node.js', 'AWS', 'Copywriting', 'SQL', 'Python'];
  const availabilities: { id: Freelancer['availability']; label: string }[] = [
    { id: 'now', label: 'Available now' },
    { id: 'this_week', label: 'This week' },
    { id: 'busy', label: 'Busy' },
    { id: 'offline', label: 'Offline' }
  ];

  const toggleSkill = (skill: string) => {
    onChangeSkills(skills.includes(skill) ? skills.filter(s => s !== skill) : [...skills, skill]);
  };

  const toggleAvailability = (id: Freelancer['availability']) => {
    onChangeAvailability(availability.includes(id) ? availability.filter(a => a !== id) : [...availability, id]);
  };

  return (
    <aside className={`w-[260px] flex-shrink-0 bg-surface border-r border-border p-24 self-start sticky top-24 ${className}`}>
      <div className="flex items-center justify-between mb-32">
        <h2 className="text-body font-semibold text-text">Filters</h2>
        <button onClick={onClearFilters} className="text-meta text-text-dim hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm">
          Clear filters
        </button>
      </div>

      <div className="space-y-32">
        {/* Skills */}
        <section>
          <h3 className="text-micro-label text-text-mute mb-12">Skills</h3>
          <div className="flex flex-wrap gap-8">
            {allSkills.map(skill => (
              <Chip 
                key={skill} 
                selected={skills.includes(skill)}
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </Chip>
            ))}
          </div>
        </section>

        {/* Hourly Rate */}
        <section>
          <h3 className="text-micro-label text-text-mute mb-12">Hourly rate</h3>
          <div className="flex items-center gap-8">
            <div className="relative flex-1">
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-text-mute font-mono text-meta">$</span>
              <Input 
                type="number" 
                placeholder="Min" 
                className="pl-20 font-mono" 
                value={rateMin || ''}
                onChange={(e) => onChangeRateMin(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <span className="text-text-mute">-</span>
            <div className="relative flex-1">
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-text-mute font-mono text-meta">$</span>
              <Input 
                type="number" 
                placeholder="Max" 
                className="pl-20 font-mono" 
                value={rateMax || ''}
                onChange={(e) => onChangeRateMax(e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        </section>

        {/* Availability */}
        <section>
          <h3 className="text-micro-label text-text-mute mb-12">Availability</h3>
          <div className="space-y-8">
            {availabilities.map(a => (
              <button 
                key={a.id}
                onClick={() => toggleAvailability(a.id)}
                className={`flex items-center gap-8 w-full p-4 -ml-4 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${availability.includes(a.id) ? 'bg-surface-2' : 'hover:bg-surface-2 transition-colors'}`}
              >
                <StatusDot status={a.id} />
                <span className="text-body text-text">{a.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Minimum Rating */}
        <section>
          <h3 className="text-micro-label text-text-mute mb-12">Minimum rating</h3>
          <div className="flex justify-between gap-4">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                onClick={() => onChangeMinRating(minRating === rating ? null : rating)}
                className={`flex-1 h-32 rounded-md font-mono text-meta focus:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-colors hover:bg-surface-2 ${minRating === rating ? 'text-text bg-surface-3' : 'text-text-dim'}`}
              >
                {rating}+
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};
