import type { BriefExtraction, MatchLine, ReviewSummary, ExperienceEntry, EducationEntry } from '@/types';
import { api } from '@/lib/data/api';

export interface ResumeSuggestions {
  name: string;
  headline: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
}

/** Server-side AI. Callers treat failures as "no refinement" and keep their local result. */
export const aiService = {
  extractBrief: (brief: string, knownSkills: string[]) => api.post<BriefExtraction>('/ai/extract-brief', { brief, knownSkills }),
  generateMatchReasoning: (brief: string, freelancerIds: string[]) => api.post<MatchLine[]>('/ai/match', { brief, freelancerIds }),
  summarizeReviews: (freelancerId: string) => api.post<ReviewSummary>('/ai/review-summary', { freelancerId }),
  // The server reads the resume the person just uploaded, so no path crosses the wire.
  parseResume: async (_path?: string) => (await api.post<{ suggestions: ResumeSuggestions }>('/ai/resume')).suggestions,
};
