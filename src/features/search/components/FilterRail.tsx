import React from 'react';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Input';
import { StatusDot } from '@/components/ui/StatusDot';
import { AVAILABILITY_OPTIONS } from '@/lib/format';
import type { ManualFilters } from '../searchState';

interface FilterRailProps {
  className?: string;
  filters: ManualFilters;
  onChange: (next: Partial<ManualFilters>) => void;
  allSkills: string[];
  skillCounts: Record<string, number>;
  allLanguages: string[];
  onClear: () => void;
  hasFilters: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-12">
    <h3 className="text-meta font-medium text-text-dim">{title}</h3>
    {children}
  </section>
);

const SKILLS_COLLAPSED = 12;

export const FilterRail: React.FC<FilterRailProps> = ({ className = '', filters, onChange, allSkills, skillCounts, allLanguages, onClear, hasFilters }) => {
  const [skillTerm, setSkillTerm] = React.useState('');
  const [showAllSkills, setShowAllSkills] = React.useState(false);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const sortedSkills = React.useMemo(
    () => [...allSkills].sort((a, b) => (skillCounts[b] ?? 0) - (skillCounts[a] ?? 0) || a.localeCompare(b)),
    [allSkills, skillCounts],
  );
  const term = skillTerm.trim().toLowerCase();
  const matching = term ? sortedSkills.filter((s) => s.toLowerCase().includes(term)) : sortedSkills;
  // Selected skills always stay visible, even when collapsed.
  const visible = term || showAllSkills ? matching : [...new Set([...filters.skills, ...matching.slice(0, SKILLS_COLLAPSED)])];

  return (
    <div className={`bg-surface border border-border rounded-lg p-20 ${className}`}>
      <div className="flex items-center justify-between mb-24">
        <h2 className="text-body font-semibold text-text">Filters</h2>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilters}
          className="text-meta text-text-dim hover:text-text rounded-sm disabled:opacity-50 disabled:hover:text-text-dim"
        >
          Clear filters
        </button>
      </div>

      <div className="flex flex-col gap-24">
        <Section title="Name or title">
          <Input
            type="search"
            aria-label="Search by name or title"
            placeholder="e.g. designer"
            value={filters.keyword}
            onChange={(e) => onChange({ keyword: e.target.value })}
          />
        </Section>

        <Section title="Skills">
          <Input
            type="search"
            aria-label="Find a skill"
            placeholder="Find a skill"
            value={skillTerm}
            onChange={(e) => setSkillTerm(e.target.value)}
          />
          <div className="flex flex-wrap gap-8" role="group" aria-label="Skills">
            {visible.map((skill) => (
              <Chip key={skill} selected={filters.skills.includes(skill)} onClick={() => onChange({ skills: toggle(filters.skills, skill) })}>
                {skill}
              </Chip>
            ))}
            {visible.length === 0 && <p className="text-meta text-text-dim">No skills match.</p>}
          </div>
          {!term && matching.length > SKILLS_COLLAPSED && (
            <button type="button" onClick={() => setShowAllSkills((v) => !v)} aria-expanded={showAllSkills} className="self-start text-meta text-text-dim hover:text-text underline underline-offset-4 rounded-sm">
              {showAllSkills ? 'Show fewer' : `Show all ${matching.length}`}
            </button>
          )}
        </Section>

        <Section title="Hourly rate (USD)">
          <div className="flex items-center gap-8">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="Minimum hourly rate"
              placeholder="Min"
              className="font-mono"
              value={filters.rateMin ?? ''}
              onChange={(e) => onChange({ rateMin: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
            />
            <span className="text-text-dim" aria-hidden="true">–</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label="Maximum hourly rate"
              placeholder="Max"
              className="font-mono"
              value={filters.rateMax ?? ''}
              onChange={(e) => onChange({ rateMax: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
            />
          </div>
        </Section>

        <Section title="Availability">
          <div className="flex flex-col gap-4" role="group" aria-label="Availability">
            {AVAILABILITY_OPTIONS.map((a) => {
              const on = filters.availability.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ availability: toggle(filters.availability, a.id) })}
                  className={`flex items-center gap-8 w-full h-32 px-8 rounded-md text-body transition-colors duration-120 ${on ? 'bg-surface-3 text-text font-medium' : 'text-text-dim hover:bg-surface-2 hover:text-text'}`}
                >
                  <StatusDot status={a.id} />
                  {a.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Minimum rating">
          <div className="grid grid-cols-4 gap-4" role="group" aria-label="Minimum rating">
            {[3, 4, 4.5, 4.8].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={filters.minRating === r}
                onClick={() => onChange({ minRating: filters.minRating === r ? null : r })}
                className={`h-32 rounded-md font-mono tabular-nums text-meta transition-colors duration-120 ${filters.minRating === r ? 'bg-surface-3 text-text' : 'text-text-dim hover:bg-surface-2 hover:text-text'}`}
              >
                {r}+
              </button>
            ))}
          </div>
        </Section>

        {allLanguages.length > 0 && (
          <Section title="Language">
            <div className="flex flex-wrap gap-8" role="group" aria-label="Language">
              {allLanguages.map((l) => (
                <Chip key={l} selected={filters.languages.includes(l)} onClick={() => onChange({ languages: toggle(filters.languages, l) })}>
                  {l}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="Time zone">
          <Checkbox label="Overlaps my working hours" checked={filters.overlap} onChange={(e) => onChange({ overlap: e.target.checked })} />
        </Section>
      </div>
    </div>
  );
};
