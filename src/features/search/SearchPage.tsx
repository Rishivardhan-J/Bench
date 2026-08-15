import React, { useState } from 'react';
import { HeroBrief } from './components/HeroBrief';
import { FilterRail } from './components/FilterRail';
import { ResultsTable } from './components/ResultsTable';
import type { SortOption } from './components/ResultsTable';
import { useQuery } from '@tanstack/react-query';
import { DemoFreelancerProvider } from '@/lib/providers/freelancer-provider';
import { useDebounce } from '@/hooks/useDebounce';
import type { Freelancer, ShortlistReasoning } from '@/types';
import { Button } from '@/components/ui/Button';
import { aiService } from '@/lib/services/ai-service';

const provider = new DemoFreelancerProvider();

export const SearchPage: React.FC = () => {
  const [brief, setBrief] = useState('');
  const [keyword, setKeyword] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [rateMin, setRateMin] = useState<number | null>(null);
  const [rateMax, setRateMax] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Freelancer['availability'][]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [sortField, setSortField] = useState<SortOption['field']>('rating');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // AI flow state
  const [isGenerating, setIsGenerating] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [reasoningData, setReasoningData] = useState<Record<string, ShortlistReasoning>>({});

  // Debounced text and rate inputs
  const debouncedKeyword = useDebounce(keyword, 300);
  const debouncedRateMin = useDebounce(rateMin, 300);
  const debouncedRateMax = useDebounce(rateMax, 300);

  const { data: allSkills = [] } = useQuery({
    queryKey: ['availableSkills'],
    queryFn: () => provider.getAvailableSkills()
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['freelancers', debouncedKeyword, skills, debouncedRateMin, debouncedRateMax, availability, minRating],
    queryFn: () => provider.search({
      query: debouncedKeyword,
      skills,
      rateMin: debouncedRateMin || undefined,
      rateMax: debouncedRateMax || undefined,
      availability,
      minRating: minRating || undefined
    })
  });

  const clearFilters = () => {
    setSkills([]);
    setRateMin(null);
    setRateMax(null);
    setAvailability([]);
    setMinRating(null);
  };

  const clearAll = () => {
    clearFilters();
    setBrief('');
    setKeyword('');
    setReasoningData({});
    setSortField('rating');
  };

  const handleGenerateShortlist = async () => {
    if (!brief.trim() || brief.length > 2000) return;
    setIsGenerating(true);
    setBriefError(null);
    try {
      const extraction = await aiService.extractBrief(brief);
      
      // Map extracted values to filters
      setSkills(extraction.extractedSkills);
      let newRateMin: number | null = null;
      let newRateMax: number | null = null;
      
      if (extraction.budgetBand === 'low') { newRateMin = 0; newRateMax = 40; }
      else if (extraction.budgetBand === 'mid') { newRateMin = 40; newRateMax = 90; }
      else if (extraction.budgetBand === 'high') { newRateMin = 90; newRateMax = null; }
      
      setRateMin(newRateMin);
      setRateMax(newRateMax);
      
      // Delay to allow chips to animate
      await new Promise(r => setTimeout(r, 200));

      // Compute filtered candidate list manually
      const candidates = await provider.search({
        skills: extraction.extractedSkills,
        rateMin: newRateMin || undefined,
        rateMax: newRateMax || undefined,
        availability,
        minRating: minRating || undefined
      });

      if (candidates.length === 0) {
        setReasoningData({});
      } else {
        const reasoning = await aiService.generateMatchReasoning(brief, candidates);
        const reasoningMap: Record<string, ShortlistReasoning> = {};
        reasoning.forEach(r => reasoningMap[r.freelancerId] = r);
        setReasoningData(reasoningMap);
        setSortField('relevance');
        setSortDirection('desc');
      }
      
      setTimeout(() => setIsGenerating(false), 3000); // Cooldown
    } catch (error) {
      setIsGenerating(false);
      let errorMessage = "Failed to generate shortlist. Please try again.";
      if (error instanceof Error && error.message.includes('resource-exhausted')) {
        errorMessage = "You've hit the generation limit for now — try again in a bit.";
      }
      setBriefError(errorMessage);
    }
  };

  // Sorting logic (in-memory)
  const sortedData = React.useMemo(() => {
    if (!data) return [];
    const arr = [...data];
    arr.sort((a, b) => {
      let valA: number;
      let valB: number;
      
      switch (sortField) {
        case 'relevance':
          // We have the reasoning data array order from AI, but it's converted to a map.
          // Wait, the API returns an ordered array. We didn't save the array order.
          // Let's rely on matchedCriteria length or something, or better: 
          // add a rank to the reasoningData when building the map!
          const rankA = reasoningData[a.id] ? Object.keys(reasoningData).indexOf(a.id) : 999;
          const rankB = reasoningData[b.id] ? Object.keys(reasoningData).indexOf(b.id) : 999;
          valA = -rankA; // smaller index is better (larger negative)
          valB = -rankB;
          break;
        case 'rate':
          // use average rate for sorting
          valA = (a.rateMin + a.rateMax) / 2;
          valB = (b.rateMin + b.rateMax) / 2;
          break;
        case 'rating':
          valA = a.rating;
          valB = b.rating;
          break;
        case 'response_time':
          valA = a.responseTimeMinutes;
          valB = b.responseTimeMinutes;
          break;
        default:
          return 0;
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
    return arr;
  }, [data, sortField, sortDirection]);

  return (
    <>
      <HeroBrief 
        query={brief} 
        onChangeQuery={setBrief} 
        onGenerateShortlist={handleGenerateShortlist}
        isGenerating={isGenerating}
        briefError={briefError}
      />
      <div className="max-w-[1440px] mx-auto px-24 flex flex-col md:flex-row gap-32 items-start relative">
        <div className="md:hidden w-full">
          <Button 
            variant="secondary" 
            className="w-full" 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        <div className={`${showMobileFilters ? 'block' : 'hidden'} md:block w-full md:w-auto relative z-40`}>
          <FilterRail 
            className="w-full md:w-[260px] lg:w-[280px] top-[88px]"
            keyword={keyword}
            onChangeKeyword={setKeyword}
            skills={skills}
            onChangeSkills={setSkills}
            allSkills={allSkills}
            rateMin={rateMin}
            onChangeRateMin={setRateMin}
            rateMax={rateMax}
            onChangeRateMax={setRateMax}
            availability={availability}
            onChangeAvailability={setAvailability}
            minRating={minRating}
            onChangeMinRating={setMinRating}
            onClearFilters={clearFilters}
          />
        </div>

        <div className="flex-1 min-w-0 w-full relative z-10">
          <ResultsTable 
            data={sortedData} 
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onClearFilters={clearAll}
            sortField={sortField}
            sortDirection={sortDirection}
            onChangeSort={(field) => {
              if (field === 'relevance' && Object.keys(reasoningData).length === 0) return;
              if (sortField === field) {
                setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortDirection(field === 'rate' || field === 'response_time' ? 'asc' : 'desc');
              }
            }}
            reasoningData={reasoningData}
          />
        </div>
      </div>
    </>
  );
};
