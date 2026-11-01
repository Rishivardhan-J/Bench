import React from 'react';
import { Textarea } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';

const EXAMPLES = [
  { label: 'React and Firebase', text: 'Senior React developer with Firebase experience for a 3-month contract, budget $80–120/hr, start within 2 weeks.' },
  { label: 'iOS app MVP', text: 'We need an iOS developer who knows Swift and SwiftUI to build an MVP, budget $90–130/hr.' },
  { label: 'Brand illustration', text: 'Brand illustrator for a set of product illustrations, around $55–95/hr, available this week.' },
];

interface HeroBriefProps {
  brief: string;
  onChange: (brief: string) => void;
  compact: boolean;
}

export const HeroBrief: React.FC<HeroBriefProps> = ({ brief, onChange, compact }) => {
  const id = React.useId();
  const nearLimit = brief.length > 1500;

  return (
    <section aria-labelledby={`${id}-title`} className={`w-full max-w-narrow mx-auto px-16 sm:px-24 ${compact ? 'pt-32 pb-24' : 'pt-48 sm:pt-64 pb-32 sm:pb-48'}`}>
      <div className="flex flex-col items-center text-center mb-24">
        <h1 id={`${id}-title`} className="text-hero text-text mb-12">
          Describe the job. Get a shortlist.
        </h1>
        <p className="text-body text-text-dim max-w-prose">
          Write it the way you would tell a friend. Skills, budget and timing become filters you can change.
        </p>
      </div>

      <div className="relative">
        <label htmlFor={id} className="sr-only">
          Describe your project
        </label>
        <Textarea
          id={id}
          value={brief}
          onChange={(e) => onChange(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="e.g. Senior React developer for a 3-month contract, budget $80–120/hr, must know Firebase, start within 2 weeks."
          aria-describedby={`${id}-count`}
        />
        <div
          id={`${id}-count`}
          aria-live="polite"
          className={`absolute bottom-8 right-12 text-meta ${brief.length >= 2000 ? 'text-text font-medium' : 'text-text-dim'}`}
        >
          {nearLimit ? `${brief.length} / 2000` : ''}
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-8" role="group" aria-label="Example briefs">
        <span className="text-meta text-text-dim">Try:</span>
        {EXAMPLES.map((ex) => (
          <Chip key={ex.label} onClick={() => onChange(ex.text)}>
            {ex.label}
          </Chip>
        ))}
      </div>
    </section>
  );
};
