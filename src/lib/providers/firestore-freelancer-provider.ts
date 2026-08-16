import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Freelancer } from '@/types';
import type { FreelancerProvider } from './freelancer-provider';

export class FirestoreFreelancerProvider implements FreelancerProvider {
  async search(params: {
    query?: string;
    skills?: string[];
    rateMin?: number;
    rateMax?: number;
    availability?: Freelancer['availability'][];
    minRating?: number;
  }): Promise<Freelancer[]> {
    const profilesRef = collection(db, 'freelancerProfiles');
    // Only fetch approved profiles
    const q = query(profilesRef, where('approved', '==', true));
    const snapshot = await getDocs(q);
    
    let results: Freelancer[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer));

    // In-memory filtering identical to DemoFreelancerProvider
    if (params.query) {
      const qText = params.query.toLowerCase();
      results = results.filter(f => 
        f.name.toLowerCase().includes(qText) || 
        f.role.toLowerCase().includes(qText)
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
      results = results.filter(f => f.rating !== undefined && f.rating >= params.minRating!);
    }

    return results;
  }

  async getById(id: string): Promise<Freelancer | null> {
    const docRef = doc(db, 'freelancerProfiles', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.approved !== true) return null;
    return { id: snap.id, ...data } as Freelancer;
  }

  async getAvailableSkills(): Promise<string[]> {
    const profilesRef = collection(db, 'freelancerProfiles');
    const q = query(profilesRef, where('approved', '==', true));
    const snapshot = await getDocs(q);
    
    const skillsSet = new Set<string>();
    snapshot.docs.forEach(d => {
      const skills = d.data().skills || [];
      skills.forEach((s: string) => skillsSet.add(s));
    });
    return Array.from(skillsSet).sort();
  }
}
