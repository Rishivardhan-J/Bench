import { api } from './api';
import { useLive } from './live';
import type { Project, Proposal, ProposalStatus, SavedSearch, SearchParams } from '@/types';

export const useOpenProjects = (enabled: boolean) =>
  useLive<Project[]>(enabled ? 'projects' : null, ['open'], async () => (await api.get<{ projects: Project[] }>('/projects?scope=open')).projects, []);

export const useMyProjects = (uid: string | null) =>
  useLive<Project[]>(uid ? 'projects' : null, ['mine', uid], async () => (await api.get<{ projects: Project[] }>('/projects?scope=mine')).projects, []);

export const useProject = (id: string | null) =>
  useLive<Project | null>(id ? 'projects' : null, ['one', id], async () => (await api.get<{ project: Project }>(`/projects/${id}`)).project, null);

export const useProposalsForProject = (projectId: string | null, clientUid: string | null) =>
  useLive<Proposal[]>(
    projectId && clientUid ? 'proposals' : null,
    ['project', projectId],
    async () => (await api.get<{ proposals: Proposal[] }>(`/projects/${projectId}/proposals`)).proposals,
    [],
  );

export const useMyProposals = (uid: string | null) =>
  useLive<Proposal[]>(uid ? 'proposals' : null, ['mine', uid], async () => (await api.get<{ proposals: Proposal[] }>('/proposals/mine')).proposals, []);

export type ProjectInput = Pick<Project, 'title' | 'description' | 'skills' | 'budgetMin' | 'budgetMax' | 'timeline'>;

export const createProject = async (_clientUid: string, _clientName: string, input: ProjectInput): Promise<string> =>
  (await api.post<{ projectId: string }>('/projects', input)).projectId;

export const updateProject = (id: string, patch: Partial<ProjectInput> & { status?: Project['status'] }) => api.patch(`/projects/${id}`, patch);

export const deleteProject = (id: string) => api.del(`/projects/${id}`);

export const submitProposal = (p: { project: Project; freelancerUid: string; freelancerName: string; message: string; rate: number }) =>
  api.post(`/projects/${p.project.id}/proposals`, { message: p.message, rate: p.rate });

export const setProposalStatus = (id: string, status: Exclude<ProposalStatus, 'chosen'>) => api.patch(`/proposals/${id}`, { status });

export const withdrawProposal = (id: string) => api.del(`/proposals/${id}`);

export const useSavedSearches = (uid: string | null) =>
  useLive<SavedSearch[]>(uid ? 'saved-searches' : null, [uid], async () => (await api.get<{ searches: SavedSearch[] }>('/saved-searches')).searches, []);

export const saveSearch = (_clientUid: string, label: string, queryText: string, filters: SearchParams) =>
  api.post('/saved-searches', { label: label.slice(0, 80), query: queryText, filters: JSON.parse(JSON.stringify(filters)) });

export const setSearchAlert = (id: string, alertEnabled: boolean) => api.patch(`/saved-searches/${id}`, { alertEnabled });

export const deleteSavedSearch = (id: string) => api.del(`/saved-searches/${id}`);
