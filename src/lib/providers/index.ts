import { DemoFreelancerProvider } from './freelancer-provider';
import { FirestoreFreelancerProvider } from './firestore-freelancer-provider';
import type { FreelancerProvider } from './freelancer-provider';

/**
 * Returns the active FreelancerProvider based on the VITE_USE_LIVE_DATA environment variable.
 * Default is the Demo provider. Set VITE_USE_LIVE_DATA=true to switch to live Firestore data.
 */
export const getProvider = (): FreelancerProvider => {
  if (import.meta.env.VITE_USE_LIVE_DATA === 'true') {
    return new FirestoreFreelancerProvider();
  }
  return new DemoFreelancerProvider();
};
