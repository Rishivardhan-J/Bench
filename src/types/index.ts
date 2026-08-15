export interface Freelancer {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  verified: boolean;
  skills: string[];
  rateMin: number;
  rateMax: number;
  currency: string;
  rating: number;
  reviewCount: number;
  responseTimeMinutes: number;
  availability: 'now' | 'this_week' | 'busy' | 'offline';
  bio: string;
  portfolioUrl?: string;
  timezone: string;
  reviews?: { text: string; rating: number }[];
}

export interface ShortlistReasoning {
  freelancerId: string;
  matchedCriteria: string[];
  reasoning: string;
}

export interface BriefExtraction {
  rawBrief: string;
  extractedSkills: string[];
  budgetBand?: 'low' | 'mid' | 'high';
  timeline?: string;
  seniority?: 'junior' | 'mid' | 'senior';
}

export interface ReviewSummary {
  freelancerId: string;
  summary: string;
}
