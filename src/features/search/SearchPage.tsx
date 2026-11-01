import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { usePageTitle } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/providers/AuthContext';
import { getProvider, isDemoMode } from '@/lib/providers';
import { aiService } from '@/lib/services/ai-service';
import { buildMatchLine, describeFilters, filterFreelancers, parseBrief } from '@/lib/search';
import { saveSearch, useSavedSearches } from '@/lib/data/projects';
import { useShortlist } from '@/lib/providers/ShortlistContext';
import { errorMessage } from '@/lib/data/api';
import type { BriefExtraction, Freelancer, MatchLine, SearchParams } from '@/types';
import { HeroBrief } from './components/HeroBrief';
import { FilterRail } from './components/FilterRail';
import { ResultsTable } from './components/ResultsTable';
import { ResultCards } from './components/ResultCards';
import { ActiveFilters } from './components/ActiveFilters';
import {
  DEFAULT_DIR,
  EMPTY_FILTERS,
  effectiveParams,
  rankingText,
  readSearchState,
  sortResults,
  writeSearchState,
} from './searchState';
import type { Derived, ManualFilters, SearchState, SortDir, SortField } from './searchState';

const BANDS: Record<'low' | 'mid' | 'high', { min: number; max?: number }> = {
  low: { min: 0, max: 40 },
  mid: { min: 40, max: 90 },
  high: { min: 90 },
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'relevance:desc', label: 'Best match' },
  { value: 'rate:asc', label: 'Rate: low to high' },
  { value: 'rate:desc', label: 'Rate: high to low' },
  { value: 'rating:desc', label: 'Rating: high to low' },
  { value: 'rating:asc', label: 'Rating: low to high' },
  { value: 'response_time:asc', label: 'Fastest response' },
  { value: 'response_time:desc', label: 'Slowest response' },
];

export const SearchPage: React.FC = () => {
  usePageTitle('Find freelancers');
  const provider = React.useMemo(() => getProvider(), []);
  const { currentUser, role, openSignInModal } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = React.useMemo(() => readSearchState(searchParams), [searchParams]);
  const timezone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const update = React.useCallback(
    (patch: Partial<SearchState> | ((s: SearchState) => SearchState)) => {
      setSearchParams(
        (prev) => {
          const current = readSearchState(prev);
          const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
          return writeSearchState(next);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // --- Brief: typed locally, mirrored to the URL after a short pause.
  const [briefInput, setBriefInput] = React.useState(state.brief);
  const debouncedBrief = useDebounce(briefInput, 400);
  React.useEffect(() => {
    if (debouncedBrief !== state.brief) update({ brief: debouncedBrief });
    // Only the debounced text drives the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedBrief]);

  // --- Catalogue: fetched once and cached; filtering and ranking happen instantly in memory.
  const { data: all = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['catalogue', isDemoMode()],
    queryFn: () => provider.search({}),
    staleTime: 60_000,
  });

  const allSkills = React.useMemo(() => {
    const seen = new Map<string, string>();
    all.forEach((f) => f.skills.forEach((s) => seen.has(s.toLowerCase()) || seen.set(s.toLowerCase(), s)));
    return [...seen.values()];
  }, [all]);
  const skillCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    all.forEach((f) => f.skills.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1)));
    return counts;
  }, [all]);
  const allLanguages = React.useMemo(() => [...new Set(all.flatMap((f) => f.languages ?? []))].sort(), [all]);

  // --- Brief understanding: local first, refined server-side when available.
  const localExtraction = React.useMemo(() => parseBrief(debouncedBrief, allSkills), [debouncedBrief, allSkills]);
  const [refined, setRefined] = React.useState<{ brief: string; extraction: BriefExtraction } | null>(null);

  React.useEffect(() => {
    const text = debouncedBrief.trim();
    if (isDemoMode() || text.length < 25 || text.split(/\s+/).length < 5 || allSkills.length === 0) {
      setRefined(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const extraction = await aiService.extractBrief(text, allSkills);
        if (!cancelled) setRefined({ brief: text, extraction });
      } catch {
        // Not configured, offline or rate limited: the local reading stays in place, silently.
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [debouncedBrief, allSkills]);

  const derived = React.useMemo<Derived>(() => {
    const local: Derived = { skills: localExtraction.extractedSkills, rateMin: localExtraction.rateMin, rateMax: localExtraction.rateMax };
    if (!refined || refined.brief !== debouncedBrief.trim()) return local;
    const ex = refined.extraction;
    const catalogue = new Map(allSkills.map((s) => [s.toLowerCase(), s]));
    const skills = ex.extractedSkills.map((s) => catalogue.get(s.toLowerCase())).filter((s): s is string => Boolean(s));
    const band = ex.budgetBand ? BANDS[ex.budgetBand] : undefined;
    return {
      skills: skills.length ? skills : local.skills,
      rateMin: ex.rateMin ?? band?.min ?? local.rateMin,
      rateMax: ex.rateMax ?? band?.max ?? local.rateMax,
    };
  }, [localExtraction, refined, debouncedBrief, allSkills]);

  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (!debouncedBrief.trim()) setDismissed(new Set());
  }, [debouncedBrief]);

  const params = React.useMemo(() => effectiveParams(state.filters, derived, dismissed, timezone), [state.filters, derived, dismissed, timezone]);
  const rankCtx = React.useMemo<SearchParams>(() => ({ ...params, query: rankingText(debouncedBrief) ?? params.query }), [params, debouncedBrief]);

  const results = React.useMemo(() => {
    const filtered = filterFreelancers(all, params);
    return sortResults(filtered, state.sort, state.dir, rankCtx);
  }, [all, params, state.sort, state.dir, rankCtx]);

  // --- Match lines: one factual sentence per result, from the real overlap with the brief.
  const hasContext = Boolean(params.skills?.length || params.rateMin !== undefined || params.rateMax !== undefined);
  const localLines = React.useMemo<Record<string, MatchLine>>(() => {
    if (!hasContext) return {};
    return Object.fromEntries(results.slice(0, 60).map((f) => [f.id, buildMatchLine(f, params)]));
  }, [results, params, hasContext]);

  const [aiLines, setAiLines] = React.useState<Record<string, MatchLine>>({});
  const topIds = results.slice(0, 10).map((f) => f.id).join(',');
  React.useEffect(() => {
    const text = debouncedBrief.trim();
    if (isDemoMode() || !refined || refined.brief !== text || !topIds) {
      setAiLines({});
      return;
    }
    let cancelled = false;
    aiService
      .generateMatchReasoning(text, topIds.split(','))
      .then((lines) => !cancelled && setAiLines(Object.fromEntries(lines.map((l) => [l.freelancerId, l]))))
      .catch(() => !cancelled && setAiLines({}));
    return () => {
      cancelled = true;
    };
  }, [refined, topIds, debouncedBrief]);
  const lines = React.useMemo(() => ({ ...localLines, ...aiLines }), [localLines, aiLines]);

  // --- Filter chips (manual and brief-derived) and their removal.
  const chips = React.useMemo(() => describeFilters(params), [params]);
  const hasFilters = chips.length > 0 || Boolean(briefInput.trim());

  const patchFilters = (patch: Partial<ManualFilters>) => update((s) => ({ ...s, filters: { ...s.filters, ...patch } }));

  const removeChip = (key: string) => {
    const [type, value] = key.split(':');
    if (type === 'skill') {
      patchFilters({ skills: state.filters.skills.filter((s) => s !== value) });
      setDismissed((d) => new Set(d).add(key));
    } else if (type === 'rate') {
      patchFilters({ rateMin: null, rateMax: null });
      setDismissed((d) => new Set(d).add('rate'));
    } else if (type === 'availability') patchFilters({ availability: state.filters.availability.filter((a) => a !== value) });
    else if (type === 'language') patchFilters({ languages: state.filters.languages.filter((l) => l !== value) });
    else if (type === 'rating') patchFilters({ minRating: null });
    else if (type === 'overlap') patchFilters({ overlap: false });
    else if (type === 'q') patchFilters({ keyword: '' });
  };

  const clearAll = () => {
    setBriefInput('');
    setDismissed(new Set());
    update({ brief: '', filters: EMPTY_FILTERS, sort: 'relevance', dir: 'desc' });
  };

  const onChangeSort = (field: SortField) => {
    if (state.sort === field) update({ dir: state.dir === 'asc' ? 'desc' : 'asc' });
    else update({ sort: field, dir: DEFAULT_DIR[field] });
  };

  // --- Compare (up to 3).
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const toggleCompare = (id: string) => setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 3 ? ids : [...ids, id]));

  // --- Saved searches (clients).
  const { data: saved } = useSavedSearches(role === 'client' ? currentUser?.uid ?? null : null);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveLabel, setSaveLabel] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const onSave = () => {
    if (!currentUser) return openSignInModal({ mode: 'signup', reason: 'Create a free client account to save searches and get alerts.' });
    if (role !== 'client') return toast('Saved searches are available on client accounts.');
    setSaveLabel(params.skills?.slice(0, 2).join(', ') || debouncedBrief.slice(0, 40) || 'My search');
    setSaveOpen(true);
  };
  const submitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !saveLabel.trim()) return;
    setSaving(true);
    try {
      await saveSearch(currentUser.uid, saveLabel.trim(), debouncedBrief, params);
      setSaveOpen(false);
      toast("Search saved. We'll let you know when a new match goes live.");
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const applySaved = (s: { query: string; filters: SearchParams }) => {
    setBriefInput(s.query);
    setDismissed(new Set());
    update({
      brief: s.query,
      filters: {
        ...EMPTY_FILTERS,
        skills: s.filters.skills ?? [],
        rateMin: s.filters.rateMin ?? null,
        rateMax: s.filters.rateMax ?? null,
        availability: s.filters.availability ?? [],
        minRating: s.filters.minRating ?? null,
        languages: s.filters.languages ?? [],
        keyword: s.filters.query ?? '',
      },
    });
  };

  // --- Recently viewed.
  const { ids: recentIds } = useRecentlyViewed();
  const recent = recentIds.map((id) => all.find((f) => f.id === id)).filter((f): f is Freelancer => Boolean(f));

  // --- Keyboard: arrows move between results, S saves the focused one (S6).
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const onResultsKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    const links = Array.from(resultsRef.current?.querySelectorAll<HTMLElement>('[data-row-link]') ?? []).filter((el) => el.offsetParent !== null);
    const idx = links.findIndex((el) => el.closest('[data-row-id]') === target.closest('[data-row-id]'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (links.length === 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? Math.min(idx + 1, links.length - 1) : Math.max(idx - 1, 0);
      links[idx === -1 ? 0 : next].focus();
    } else if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && idx !== -1) {
      const id = links[idx].closest('[data-row-id]')?.getAttribute('data-row-id');
      if (id) {
        e.preventDefault();
        requestSaveRef.current(id);
      }
    }
  };
  const { requestSave } = useShortlist();
  const requestSaveRef = React.useRef(requestSave);
  requestSaveRef.current = requestSave;

  const [showFilters, setShowFilters] = React.useState(false);
  const sortValue = `${state.sort}:${state.dir}`;

  return (
    <>
      <HeroBrief brief={briefInput} onChange={setBriefInput} compact={Boolean(briefInput.trim())} />

      <div className="max-w-shell mx-auto px-16 sm:px-24 grid xl:grid-cols-filters gap-24 items-start">
        <div className="xl:sticky xl:top-80">
          <div className="xl:hidden mb-12">
            <Button variant="secondary" className="w-full sm:w-auto" aria-expanded={showFilters} aria-controls="filter-rail" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal className="w-16 h-16" aria-hidden="true" />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </Button>
          </div>
          <div id="filter-rail" className={`${showFilters ? 'block' : 'hidden'} xl:block mb-16 xl:mb-0`}>
            <FilterRail
              filters={state.filters}
              onChange={patchFilters}
              allSkills={allSkills}
              skillCounts={skillCounts}
              allLanguages={allLanguages}
              onClear={clearAll}
              hasFilters={hasFilters}
            />
          </div>
        </div>

        <div className="min-w-0 flex flex-col gap-16" ref={resultsRef} onKeyDown={onResultsKeyDown}>
          <ActiveFilters chips={chips} onRemove={removeChip} onClear={clearAll} onSave={onSave} />

          {recent.length > 0 && !hasFilters && (
            <section aria-label="Recently viewed" className="flex flex-wrap items-center gap-12">
              <h2 className="text-meta font-medium text-text-dim">Recently viewed</h2>
              {recent.slice(0, 5).map((f) => (
                <Link key={f.id} to={`/freelancer/${f.id}`} className="inline-flex items-center gap-8 h-32 pl-4 pr-12 rounded-md border border-border text-meta text-text-dim hover:text-text hover:border-border-strong">
                  <Avatar src={f.avatarUrl} name={f.name} size="sm" />
                  {f.name}
                </Link>
              ))}
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-12">
            <p role="status" className="text-body text-text-dim min-h-24">
              {isLoading || isError ? '' : `${results.length} ${results.length === 1 ? 'freelancer' : 'freelancers'}`}
            </p>
            <div className="flex items-center gap-8">
              {saved.length > 0 && (
                <Menu
                  label="Saved searches"
                  align="right"
                  trigger={<span className="inline-flex items-center h-32 px-12 rounded-md border border-border-strong text-meta font-semibold text-text hover:bg-surface-2">Saved searches</span>}
                  items={saved.map((s) => ({ label: s.label, onSelect: () => applySaved(s) }))}
                />
              )}
              <label className="flex items-center gap-8 text-meta text-text-dim">
                <span>Sort by</span>
                <div className="w-200">
                  <Select
                    value={SORT_OPTIONS.some((o) => o.value === sortValue) ? sortValue : 'relevance:desc'}
                    onChange={(e) => {
                      const [field, dir] = e.target.value.split(':') as [SortField, SortDir];
                      update({ sort: field, dir });
                    }}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
              </label>
            </div>
          </div>

          <div className="hidden lg:block">
            <ResultsTable
              data={results}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => refetch()}
              onClearFilters={clearAll}
              sortField={state.sort}
              sortDirection={state.dir}
              onChangeSort={onChangeSort}
              lines={lines}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
          </div>
          <div className="lg:hidden">
            <ResultCards
              data={results}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => refetch()}
              onClearFilters={clearAll}
              lines={lines}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
          </div>
          <p className="hidden lg:block text-meta text-text-dim">Tip: use the arrow keys to move between results, and S to save.</p>
        </div>
      </div>

      {compareIds.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 flex justify-center px-16 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-12 bg-surface-3 border border-border-strong rounded-lg pl-16 pr-8 py-8">
            <span className="text-body text-text">{compareIds.length} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>Clear</Button>
            <ButtonLink to={`/compare?ids=${compareIds.join(',')}`} size="sm" aria-disabled={compareIds.length < 2} onClick={(e) => compareIds.length < 2 && e.preventDefault()}>
              {compareIds.length < 2 ? 'Pick one more' : 'Compare'}
            </ButtonLink>
          </div>
        </div>
      )}

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} title="Save this search" description="We'll notify you when a new freelancer who matches goes live.">
        <form onSubmit={submitSave} className="flex flex-col gap-16">
          <Field label="Name" required>
            <Input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} maxLength={80} autoFocus />
          </Field>
          <div className="flex justify-end gap-8">
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!saveLabel.trim()}>Save search</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
