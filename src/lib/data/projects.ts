import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toMillis } from './api';
import { useLiveCollection, useLiveDoc } from './live';
import type { Project, Proposal, ProposalStatus, SavedSearch, SearchParams } from '@/types';

type Row = { id: string; data: (opts?: never) => Record<string, unknown> };

function mapProject(d: Row): Project {
  const x = d.data();
  return {
    id: d.id,
    clientUid: x.clientUid as string,
    clientName: x.clientName as string | undefined,
    title: x.title as string,
    description: x.description as string,
    skills: (x.skills ?? []) as string[],
    budgetMin: (x.budgetMin as number) ?? 0,
    budgetMax: (x.budgetMax as number) ?? 0,
    timeline: (x.timeline as string) ?? '',
    status: x.status as Project['status'],
    createdAt: toMillis(x.createdAt),
  };
}

function mapProposal(d: Row): Proposal {
  const x = d.data();
  return {
    id: d.id,
    projectId: x.projectId as string,
    projectTitle: x.projectTitle as string | undefined,
    clientUid: x.clientUid as string,
    freelancerUid: x.freelancerUid as string,
    freelancerName: x.freelancerName as string | undefined,
    message: x.message as string,
    rate: x.rate as number,
    status: x.status as ProposalStatus,
    threadId: x.threadId as string | undefined,
    createdAt: toMillis(x.createdAt),
  };
}

export const useOpenProjects = (enabled: boolean) =>
  useLiveCollection<Project>(
    enabled ? 'projects:open' : null,
    () => query(collection(db, 'projects'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(100)),
    (d) => mapProject(d as unknown as Row),
  );

export const useMyProjects = (uid: string | null) =>
  useLiveCollection<Project>(
    uid ? `projects:mine:${uid}` : null,
    () => query(collection(db, 'projects'), where('clientUid', '==', uid!), orderBy('createdAt', 'desc'), limit(100)),
    (d) => mapProject(d as unknown as Row),
  );

export const useProject = (id: string | null) =>
  useLiveDoc<Project>(id ? `project:${id}` : null, () => doc(db, 'projects', id!), (d) => mapProject(d as unknown as Row));

export const useProposalsForProject = (projectId: string | null, clientUid: string | null) =>
  useLiveCollection<Proposal>(
    projectId && clientUid ? `proposals:project:${projectId}` : null,
    () => query(collection(db, 'proposals'), where('clientUid', '==', clientUid!), where('projectId', '==', projectId!), limit(100)),
    (d) => mapProposal(d as unknown as Row),
  );

export const useMyProposals = (uid: string | null) =>
  useLiveCollection<Proposal>(
    uid ? `proposals:mine:${uid}` : null,
    () => query(collection(db, 'proposals'), where('freelancerUid', '==', uid!), orderBy('createdAt', 'desc'), limit(100)),
    (d) => mapProposal(d as unknown as Row),
  );

export type ProjectInput = Pick<Project, 'title' | 'description' | 'skills' | 'budgetMin' | 'budgetMax' | 'timeline'>;

export const createProject = (clientUid: string, clientName: string, input: ProjectInput) =>
  addDoc(collection(db, 'projects'), { ...input, clientUid, clientName, status: 'open', createdAt: serverTimestamp() });

export const updateProject = (id: string, patch: Partial<ProjectInput> & { status?: Project['status'] }) =>
  updateDoc(doc(db, 'projects', id), patch);

export const deleteProject = (id: string) => deleteDoc(doc(db, 'projects', id));

export const submitProposal = (p: { project: Project; freelancerUid: string; freelancerName: string; message: string; rate: number }) =>
  setDoc(doc(db, 'proposals', `${p.project.id}_${p.freelancerUid}`), {
    projectId: p.project.id,
    projectTitle: p.project.title,
    clientUid: p.project.clientUid,
    freelancerUid: p.freelancerUid,
    freelancerName: p.freelancerName,
    message: p.message,
    rate: p.rate,
    status: 'sent',
    createdAt: serverTimestamp(),
  });

export const setProposalStatus = (id: string, status: Exclude<ProposalStatus, 'chosen'>) => updateDoc(doc(db, 'proposals', id), { status });

export const withdrawProposal = (id: string) => deleteDoc(doc(db, 'proposals', id));

export const useSavedSearches = (uid: string | null) =>
  useLiveCollection<SavedSearch>(
    uid ? `saved:${uid}` : null,
    () => query(collection(db, 'savedSearches'), where('clientUid', '==', uid!), limit(50)),
    (d) => {
      const x = d.data();
      return { id: d.id, clientUid: x.clientUid, label: x.label, query: x.query ?? '', filters: (x.filters ?? {}) as SearchParams, alertEnabled: x.alertEnabled === true };
    },
  );

export const saveSearch = (clientUid: string, label: string, queryText: string, filters: SearchParams) =>
  addDoc(collection(db, 'savedSearches'), { clientUid, label: label.slice(0, 80), query: queryText, filters: JSON.parse(JSON.stringify(filters)), alertEnabled: true, createdAt: serverTimestamp() });

export const setSearchAlert = (id: string, alertEnabled: boolean) => updateDoc(doc(db, 'savedSearches', id), { alertEnabled });

export const deleteSavedSearch = (id: string) => deleteDoc(doc(db, 'savedSearches', id));
