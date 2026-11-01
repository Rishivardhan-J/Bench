import { collection, query, where, getDocs, doc, getDoc, documentId } from 'firebase/firestore';
import { db } from '../firebase';
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

const profiles = () => collection(db, 'freelancerProfiles');
// Mirrors the security rule: only approved, unpaused profiles are public.
const liveQuery = () => query(profiles(), where('approved', '==', true), where('paused', '==', false));

export class FirestoreFreelancerProvider implements FreelancerProvider {
  private async all(): Promise<Freelancer[]> {
    const snapshot = await getDocs(liveQuery());
    return snapshot.docs.map((d) => toFreelancer(d.id, d.data()));
  }

  async search(params: SearchParams): Promise<Freelancer[]> {
    return filterFreelancers(await this.all(), params);
  }

  async getById(id: string): Promise<Freelancer | null> {
    const snap = await getDoc(doc(db, 'freelancerProfiles', id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.approved !== true || data.paused === true) return null;
    return toFreelancer(snap.id, data);
  }

  async getByIds(ids: string[]): Promise<(Freelancer | null)[]> {
    if (ids.length === 0) return [];
    const found = new Map<string, Freelancer>();
    // Firestore `in` accepts 30 values per query.
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const snap = await getDocs(query(liveQuery(), where(documentId(), 'in', chunk)));
      snap.docs.forEach((d) => found.set(d.id, toFreelancer(d.id, d.data())));
    }
    return ids.map((id) => found.get(id) ?? null);
  }

  async getAvailableSkills(): Promise<string[]> {
    return collectSkills(await this.all());
  }
}
