import type { Freelancer } from '@/types';
import { demoFreelancers } from './demo-data';

export interface FreelancerProvider {
  search(params: {
    query?: string;
    skills?: string[];
    rateMin?: number;
    rateMax?: number;
    availability?: Freelancer['availability'][];
    minRating?: number;
  }): Promise<Freelancer[]>;
  getById(id: string): Promise<Freelancer | null>;
  getAvailableSkills(): Promise<string[]>;
}

export class DemoFreelancerProvider implements FreelancerProvider {
  // DEV ONLY: Artificial delay to demonstrate async states in Phase 3
  private async simulateNetworkDelay() {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async search(params: {
    query?: string;
    skills?: string[];
    rateMin?: number;
    rateMax?: number;
    availability?: Freelancer['availability'][];
    minRating?: number;
  }): Promise<Freelancer[]> {
    await this.simulateNetworkDelay();

    // DEV ONLY: Error testing trigger
    if (params.query === 'ERROR_TEST') {
      throw new Error('Simulated error for testing error boundaries.');
    }

    // In-memory filtering stub for now. Real logic in Phase 3.
    let results = [...demoFreelancers];

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(f => 
        f.name.toLowerCase().includes(q) || 
        f.role.toLowerCase().includes(q)
      );
    }

    if (params.skills && params.skills.length > 0) {
      results = results.filter(f => 
        params.skills!.some(skill => f.skills.includes(skill))
      );
    }

    if (params.rateMin !== undefined) {
      results = results.filter(f => f.rateMax >= params.rateMin!);
    }

    if (params.rateMax !== undefined) {
      results = results.filter(f => f.rateMin <= params.rateMax!);
    }

    if (params.availability && params.availability.length > 0) {
      results = results.filter(f => params.availability!.includes(f.availability));
    }

    if (params.minRating !== undefined) {
      results = results.filter(f => f.rating >= params.minRating!);
    }

    return results;
  }

  async getById(id: string): Promise<Freelancer | null> {
    await this.simulateNetworkDelay();
    const freelancer = demoFreelancers.find(f => f.id === id);
    return freelancer || null;
  }

  async getAvailableSkills(): Promise<string[]> {
    await this.simulateNetworkDelay();
    const skillsSet = new Set<string>();
    demoFreelancers.forEach(f => {
      f.skills.forEach(s => skillsSet.add(s));
    });
    return Array.from(skillsSet).sort();
  }
}
