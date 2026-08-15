import React from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';

interface HeroBriefProps {
  query: string;
  onChangeQuery: (query: string) => void;
  onGenerateShortlist: () => void;
  isGenerating: boolean;
  briefError: string | null;
}

export const HeroBrief: React.FC<HeroBriefProps> = ({ query, onChangeQuery, onGenerateShortlist, isGenerating, briefError }) => {
  return (
    <section className="w-full max-w-[920px] mx-auto pt-64 pb-48 px-24">
      <div className="flex flex-col items-center text-center mb-32">
        <span className="text-micro-label text-text-mute mb-16 tracking-[0.05em] uppercase">
          AI-matched shortlist
        </span>
        <h1 className="text-hero text-text mb-16">
          Describe the job. Get a shortlist.
        </h1>
        <p className="text-body text-text-dim max-w-[60ch]">
          Paste your project brief and we'll match it against real freelancers — skills, budget, and availability included.
        </p>
      </div>

      <div className="flex flex-col gap-16 relative">
        <div className="relative">
          <Textarea 
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            maxLength={2000}
            placeholder="e.g. Need a senior React developer for a 3-month contract, budget $80–120/hr, must have Firebase experience, start within 2 weeks."
            className={briefError ? 'border-red-500' : ''}
          />
          {query.length > 1500 && (
            <div className={`absolute bottom-8 right-12 text-meta ${query.length >= 2000 ? 'text-red-500 font-medium' : 'text-text-mute'}`}>
              {query.length} / 2000
            </div>
          )}
        </div>
        
        {briefError && (
          <div className="text-meta text-red-500 bg-red-500/10 px-12 py-8 rounded-sm">
            {briefError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-8 overflow-x-auto pb-4 -mb-4">
            <Chip interactive={false}>Landing page redesign</Chip>
            <Chip interactive={false}>iOS app MVP</Chip>
            <Chip interactive={false}>Brand illustration set</Chip>
          </div>
          <Button 
            variant="primary" 
            onClick={onGenerateShortlist}
            disabled={isGenerating || query.trim().length === 0}
          >
            {isGenerating ? 'Generating...' : 'Generate shortlist'}
          </Button>
        </div>
      </div>
    </section>
  );
};
