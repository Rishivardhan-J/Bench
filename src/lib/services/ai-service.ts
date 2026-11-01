import type { BriefExtraction, MatchLine, ReviewSummary, ExperienceEntry, EducationEntry } from '@/types';
import { callable } from '@/lib/data/api';

const extractBriefCallable = callable<{ brief: string; knownSkills: string[] }, BriefExtraction>('extractBrief');
const matchReasoningCallable = callable<{ brief: string; freelancerIds: string[] }, MatchLine[]>('generateMatchReasoning');
const summarizeReviewsCallable = callable<{ freelancerId: string }, ReviewSummary>('summarizeReviews');

export interface ResumeSuggestions {
  name: string;
  headline: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
}
const parseResumeCallable = callable<{ path: string }, { suggestions: ResumeSuggestions }>('parseResume');

/** Server-side AI. Callers treat failures as "no refinement" and keep their local result. */
export const aiService = {
  extractBrief: (brief: string, knownSkills: string[]) => extractBriefCallable({ brief, knownSkills }),
  generateMatchReasoning: (brief: string, freelancerIds: string[]) => matchReasoningCallable({ brief, freelancerIds }),
  summarizeReviews: (freelancerId: string) => summarizeReviewsCallable({ freelancerId }),
  parseResume: async (path: string) => (await parseResumeCallable({ path })).suggestions,
};
