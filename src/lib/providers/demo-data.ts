import type { Freelancer } from '@/types';
import { computeCompleteness } from '@/lib/completeness';
import seed from './seed-freelancers.json';

// The same dataset seeds the Firebase emulator (functions/scripts/seed.js).
export const demoFreelancers: Freelancer[] = (seed as unknown as Freelancer[]).map((f) => ({
  ...f,
  approved: true,
  paused: false,
  reviewStatus: 'approved' as const,
  completeness: computeCompleteness(f),
}));
