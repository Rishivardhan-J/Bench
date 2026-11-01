import type { Freelancer, SearchParams } from '@/types';
import { filterFreelancers, hasSkill } from '@/lib/search';
import { demoFreelancers } from './demo-data';

/** The single seam between the UI and wherever freelancer profiles come from. */
export interface FreelancerProvider {
  search(params: SearchParams): Promise<Freelancer[]>;
  getById(id: string): Promise<Freelancer | null>;
  getByIds(ids: string[]): Promise<(Freelancer | null)[]>;
  getAvailableSkills(): Promise<string[]>;
}

export function collectSkills(list: Freelancer[]): string[] {
  const seen = new Map<string, string>();
  list.forEach((f) => f.skills.forEach((s) => seen.has(s.toLowerCase()) || seen.set(s.toLowerCase(), s)));
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 120));

export class DemoFreelancerProvider implements FreelancerProvider {
  async search(params: SearchParams): Promise<Freelancer[]> {
    await tick();
    return filterFreelancers(demoFreelancers, params);
  }

  async getById(id: string): Promise<Freelancer | null> {
    await tick();
    return demoFreelancers.find((f) => f.id === id) ?? null;
  }

  async getByIds(ids: string[]): Promise<(Freelancer | null)[]> {
    await tick();
    return ids.map((id) => demoFreelancers.find((f) => f.id === id) ?? null);
  }

  async getAvailableSkills(): Promise<string[]> {
    await tick();
    return collectSkills(demoFreelancers);
  }
}

export { hasSkill };
