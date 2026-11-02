import { queryClient } from '@/lib/queryClient';
import { api } from './api';
import { useLive } from './live';
import type { DayStat, Freelancer, Report, Review } from '@/types';

export const CORE_FIELDS = [
  'name', 'headline', 'bio', 'skills', 'rateMin', 'rateMax', 'currency', 'timezone',
  'portfolioUrl', 'avatarUrl', 'languages', 'experience', 'education', 'portfolio',
] as const;

export type ProfileDraft = Pick<Freelancer, (typeof CORE_FIELDS)[number] | 'availability'> & {
  backOn?: string | null;
  paused?: boolean;
};

export function useOwnProfile(uid: string | null) {
  const state = useLive<Freelancer | null>(
    uid ? 'profile' : null,
    [uid],
    async () => (await api.get<{ freelancer: Freelancer }>('/me/freelancer')).freelancer,
    null,
  );
  return state;
}

/** True when a core field differs, which returns a live profile to review. */
export function coreChanged(before: Partial<Freelancer>, after: Partial<Freelancer>): boolean {
  return CORE_FIELDS.some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}

/** Saves a profile. The server applies the moderation policy: editing core fields of a live profile takes it back to review. */
export async function saveFreelancerProfile(
  _uid: string,
  _current: Freelancer,
  draft: ProfileDraft,
  opts: { submit: boolean },
): Promise<{ status: Freelancer['reviewStatus']; wentOffline: boolean }> {
  const result = await api.put<{ status: Freelancer['reviewStatus']; wentOffline: boolean }>('/me/freelancer', { draft, submit: opts.submit });
  void queryClient.invalidateQueries({ queryKey: ['live', 'profile'] });
  return result;
}

export const setProfilePaused = (paused: boolean) => api.put<{ paused: boolean }>('/me/freelancer/paused', { paused });

export async function uploadPublicImage(kind: 'avatars' | 'portfolio', _uid: string, file: File): Promise<string> {
  return (await api.upload<{ url: string }>(`/files/${kind}`, file)).url;
}

export async function uploadResume(_uid: string, file: File): Promise<string> {
  return (await api.upload<{ path: string }>('/files/resumes', file)).path;
}

export type ReviewWithName = Review & { clientName?: string };

export function useReviews(freelancerId: string | null) {
  return useLive<ReviewWithName[]>(
    freelancerId ? `reviews:${freelancerId}` : null,
    [],
    async () => (await api.get<{ reviews: ReviewWithName[] }>(`/freelancers/${freelancerId}/reviews`)).reviews,
    [],
  );
}

export function useReview(hireId: string | null) {
  return useLive<ReviewWithName | null>(
    hireId ? 'hires' : null,
    ['review', hireId],
    async () => (await api.get<{ review: ReviewWithName | null }>(`/reviews/${hireId}`)).review,
    null,
  );
}

export function useProfileStats(uid: string | null) {
  return useLive<DayStat[]>(uid ? 'stats' : null, [uid], async () => (await api.get<{ stats: DayStat[] }>('/me/stats')).stats, []);
}

export function useHires(clientUid: string | null) {
  return useLive<{ id: string; freelancerUid: string; projectId?: string }[]>(
    clientUid ? 'hires' : null,
    [clientUid],
    async () => (await api.get<{ hires: { id: string; freelancerUid: string; projectId?: string }[] }>('/hires')).hires,
    [],
  );
}

export interface TrackRecord {
  visible: boolean;
  requests: number;
  answered: number;
  expired: number;
  hires: number;
  repeatClients: number;
  typicalReplyMinutes: number | null;
}

export const getTrackRecord = (freelancerId: string) => api.get<TrackRecord>(`/freelancers/${freelancerId}/track-record`);

export const trackProfileView = (data: { freelancerUid: string }) => api.post<{ counted: boolean }>(`/freelancers/${data.freelancerUid}/view`);
export const deleteAccount = () => api.del<{ deleted: boolean }>('/account');

export const submitReport = (data: { reporterUid?: string; targetType: Report['targetType']; targetId: string; reason: string }) =>
  api.post('/reports', { targetType: data.targetType, targetId: data.targetId, reason: data.reason });

// Admin
export const reviewProfile = (data: { uid: string; decision: 'approve' | 'request_changes'; note?: string }) => api.post<{ ok: boolean }>('/admin/review', data);
export const setVerified = (data: { uid: string; verified: boolean }) => api.post<{ ok: boolean }>('/admin/verify', data);
export const resolveReport = (data: { reportId: string; suspend?: boolean }) => api.post<{ ok: boolean }>(`/admin/reports/${data.reportId}/resolve`, { suspend: data.suspend });
export const lookupUser = (data: { email: string }) =>
  api.post<{ uid: string; email: string; role: string | null; disabled: boolean; createdAt: string; profile: { name: string; approved: boolean; reviewStatus: string } | null }>('/admin/lookup', data);

export function usePendingProfiles(enabled: boolean) {
  return useLive<Freelancer[]>(enabled ? 'admin' : null, ['pending'], async () => (await api.get<{ freelancers: Freelancer[] }>('/admin/pending')).freelancers, []);
}

export function useOpenReports(enabled: boolean) {
  return useLive<Report[]>(enabled ? 'admin' : null, ['reports'], async () => (await api.get<{ reports: Report[] }>('/admin/reports')).reports, []);
}
