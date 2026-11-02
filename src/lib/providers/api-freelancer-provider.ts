import { api } from '@/lib/data/api';
import type { Freelancer, SearchParams } from '@/types';
import { filterFreelancers } from '@/lib/search';
import { collectSkills } from './freelancer-provider';
import type { FreelancerProvider } from './freelancer-provider';

/** Fills optional collections so the UI never has to null-check them. */
export function toFreelancer(id: string, data: Record<string, unknown>): Freelancer {
  return {
    languages: [],
    experience: [],
    education: [],
    portfolio: [],
    skills: [],
    ...data,
    id,
  } as unknown as Freelancer;
}

const normalise = (f: Freelancer) => toFreelancer(f.id, f as unknown as Record<string, unknown>);

export class ApiFreelancerProvider implements FreelancerProvider {
  private async all(): Promise<Freelancer[]> {
    return (await api.get<{ freelancers: Freelancer[] }>('/freelancers')).freelancers.map(normalise);
  }

  async search(params: SearchParams): Promise<Freelancer[]> {
    return filterFreelancers(await this.all(), params);
  }

  async getById(id: string): Promise<Freelancer | null> {
    try {
      return normalise((await api.get<{ freelancer: Freelancer }>(`/freelancers/${encodeURIComponent(id)}`)).freelancer);
    } catch (error) {
      if ((error as { code?: string }).code === 'not-found') return null;
      throw error;
    }
  }

  async getByIds(ids: string[]): Promise<(Freelancer | null)[]> {
    if (ids.length === 0) return [];
    const { freelancers } = await api.post<{ freelancers: (Freelancer | null)[] }>('/freelancers/by-ids', { ids });
    return freelancers.map((f) => (f ? normalise(f) : null));
  }

  async getAvailableSkills(): Promise<string[]> {
    return collectSkills(await this.all());
  }
}
