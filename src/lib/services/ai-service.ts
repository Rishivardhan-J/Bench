import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import type { BriefExtraction, ShortlistReasoning, ReviewSummary, Freelancer } from '@/types';

const extractBriefCallable = httpsCallable<{ brief: string }, BriefExtraction>(functions, 'extractBrief');
const generateMatchReasoningCallable = httpsCallable<{ brief: string; freelancers: Partial<Freelancer>[] }, ShortlistReasoning[]>(functions, 'generateMatchReasoning');
const summarizeReviewsCallable = httpsCallable<{ freelancerId: string; reviews: { text: string; rating: number }[] }, ReviewSummary>(functions, 'summarizeReviews');

export const aiService = {
  extractBrief: async (brief: string): Promise<BriefExtraction> => {
    const result = await extractBriefCallable({ brief });
    return result.data;
  },

  generateMatchReasoning: async (brief: string, freelancers: Freelancer[]): Promise<ShortlistReasoning[]> => {
    // Trim payload to only necessary fields
    const trimmed = freelancers.map(f => ({
      id: f.id,
      name: f.name,
      role: f.role,
      skills: f.skills,
      bio: f.bio,
      rateMin: f.rateMin,
      rateMax: f.rateMax,
      availability: f.availability
    }));
    const result = await generateMatchReasoningCallable({ brief, freelancers: trimmed });
    return result.data;
  },

  summarizeReviews: async (freelancerId: string, reviews: { text: string; rating: number }[]): Promise<ReviewSummary> => {
    const result = await summarizeReviewsCallable({ freelancerId, reviews });
    return result.data;
  }
};
