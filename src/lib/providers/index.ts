import { DemoFreelancerProvider } from './freelancer-provider';
import { ApiFreelancerProvider } from './api-freelancer-provider';
import type { FreelancerProvider } from './freelancer-provider';

let instance: FreelancerProvider | null = null;

/**
 * Live data from the Bench API is the default. Set VITE_USE_LIVE_DATA=false to browse the built-in
 * demo profiles without any backend (search and profile viewing only).
 */
export const getProvider = (): FreelancerProvider => {
  if (!instance) {
    instance = import.meta.env.VITE_USE_LIVE_DATA === 'false' ? new DemoFreelancerProvider() : new ApiFreelancerProvider();
  }
  return instance;
};

export const isDemoMode = (): boolean => import.meta.env.VITE_USE_LIVE_DATA === 'false';
