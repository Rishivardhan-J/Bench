import { addDoc, collection, doc, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { toFreelancer } from '@/lib/providers/firestore-freelancer-provider';
import { callable, toMillis } from './api';
import { useLiveCollection, useLiveDoc } from './live';
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
  return useLiveDoc<Freelancer>(
    uid ? `own-profile:${uid}` : null,
    () => doc(db, 'freelancerProfiles', uid!),
    (d) => toFreelancer(d.id, d.data() ?? {}),
  );
}

/** True when a core field differs, which returns a live profile to review. */
export function coreChanged(before: Partial<Freelancer>, after: Partial<Freelancer>): boolean {
  return CORE_FIELDS.some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}

/**
 * Saves a profile. The security rules enforce the same moderation policy: editing core fields
 * of a live profile takes it offline and back to "pending".
 */
export async function saveFreelancerProfile(
  uid: string,
  current: Freelancer,
  draft: ProfileDraft,
  opts: { submit: boolean },
): Promise<{ status: Freelancer['reviewStatus']; wentOffline: boolean }> {
  const wasLive = current.approved === true;
  const changedCore = coreChanged(current, draft as Partial<Freelancer>);
  const staysLive = wasLive && !changedCore && !opts.submit;

  let status: Freelancer['reviewStatus'];
  if (staysLive) status = 'approved';
  else if (opts.submit || wasLive || current.reviewStatus === 'pending') status = 'pending';
  else status = 'draft';

  await updateDoc(doc(db, 'freelancerProfiles', uid), {
    ...draft,
    backOn: draft.backOn || null,
    approved: staysLive,
    reviewStatus: status,
    updatedAt: serverTimestamp(),
  });
  return { status, wentOffline: wasLive && !staysLive };
}

export async function uploadPublicImage(kind: 'avatars' | 'portfolio', uid: string, file: File): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const r = ref(storage, `${kind}/${uid}/${Date.now()}.${ext}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}

export async function uploadResume(uid: string, file: File): Promise<string> {
  const path = `resumes/${uid}/resume.pdf`;
  await uploadBytes(ref(storage, path), file, { contentType: 'application/pdf' });
  return path;
}

function mapReview(d: { id: string; data: () => Record<string, unknown> }): Review {
  const data = d.data();
  return {
    id: d.id,
    hireId: data.hireId as string,
    clientUid: data.clientUid as string,
    freelancerUid: data.freelancerUid as string,
    rating: data.rating as number,
    text: data.text as string,
    reply: (data.reply as string | undefined) ?? undefined,
    createdAt: toMillis(data.createdAt),
    ...({ clientName: data.clientName as string } as object),
  } as Review & { clientName?: string };
}

export type ReviewWithName = Review & { clientName?: string };

export function useReviews(freelancerId: string | null) {
  return useLiveCollection<ReviewWithName>(
    freelancerId ? `reviews:${freelancerId}` : null,
    () => query(collection(db, 'reviews'), where('freelancerUid', '==', freelancerId!), orderBy('createdAt', 'desc'), limit(50)),
    mapReview,
  );
}

export function useReview(hireId: string | null) {
  return useLiveDoc<ReviewWithName>(hireId ? `review:${hireId}` : null, () => doc(db, 'reviews', hireId!), (d) => mapReview(d as never));
}

export function useProfileStats(uid: string | null) {
  return useLiveCollection<DayStat>(
    uid ? `stats:${uid}` : null,
    () => query(collection(db, 'profileStats', uid!, 'days'), orderBy('day', 'desc'), limit(28)),
    (d) => {
      const x = d.data();
      return { day: x.day, views: x.views ?? 0, shortlistAdds: x.shortlistAdds ?? 0, requests: x.requests ?? 0 };
    },
  );
}

export function useHires(clientUid: string | null) {
  return useLiveCollection<{ id: string; freelancerUid: string; projectId?: string }>(
    clientUid ? `hires:${clientUid}` : null,
    () => query(collection(db, 'hires'), where('clientUid', '==', clientUid!), limit(200)),
    (d) => ({ id: d.id, freelancerUid: d.data().freelancerUid, projectId: d.data().projectId ?? undefined }),
  );
}

export const trackProfileView = callable<{ freelancerUid: string }, { counted: boolean }>('trackProfileView');
export const deleteAccount = callable<Record<string, never>, { deleted: boolean }>('deleteAccount');

export const submitReport = (data: { reporterUid: string; targetType: Report['targetType']; targetId: string; reason: string }) =>
  addDoc(collection(db, 'reports'), { ...data, status: 'open', createdAt: serverTimestamp() });

// Admin
export const reviewProfile = callable<{ uid: string; decision: 'approve' | 'request_changes'; note?: string }, { ok: boolean }>('reviewProfile');
export const setVerified = callable<{ uid: string; verified: boolean }, { ok: boolean }>('setVerified');
export const resolveReport = callable<{ reportId: string; suspend?: boolean }, { ok: boolean }>('resolveReport');
export const lookupUser = callable<
  { email: string },
  { uid: string; email: string; role: string | null; disabled: boolean; createdAt: string; profile: { name: string; approved: boolean; reviewStatus: string } | null }
>('lookupUser');

export function usePendingProfiles(enabled: boolean) {
  return useLiveCollection<Freelancer>(
    enabled ? 'admin:pending' : null,
    () => query(collection(db, 'freelancerProfiles'), where('reviewStatus', '==', 'pending'), orderBy('updatedAt', 'asc'), limit(100)),
    (d) => toFreelancer(d.id, d.data()),
  );
}

export function useOpenReports(enabled: boolean) {
  return useLiveCollection<Report>(
    enabled ? 'admin:reports' : null,
    () => query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(100)),
    (d) => {
      const x = d.data();
      return { id: d.id, reporterUid: x.reporterUid, targetType: x.targetType, targetId: x.targetId, reason: x.reason, status: x.status, createdAt: toMillis(x.createdAt) };
    },
  );
}
