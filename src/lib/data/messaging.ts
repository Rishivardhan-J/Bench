import { api, toMillis } from './api';
import { useLive } from './live';
import { queryClient } from '@/lib/queryClient';
import type { Attachment, Connection, DeclineReason, Message, Thread } from '@/types';

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain';

export function useThreads(uid: string | null) {
  return useLive<Thread[]>(uid ? 'threads' : null, [uid], async () => (await api.get<{ threads: Thread[] }>('/threads')).threads, []);
}

export function useMessages(threadId: string | null) {
  return useLive<Message[]>(
    threadId ? `messages:${threadId}` : null,
    [],
    async () => (await api.get<{ messages: Message[] }>(`/threads/${threadId}/messages`)).messages,
    [],
  );
}

export function uploadAttachment(threadId: string, file: File): Promise<Attachment> {
  return api.upload<Attachment>(`/threads/${threadId}/attachments`, file);
}

/** Sends a message and shows it straight away; the socket then refreshes the thread for both people. */
export async function sendMessage(
  threadId: string,
  _senderUid: string,
  text: string,
  attachments: Attachment[] = [],
  opts: { confirmOffPlatform?: boolean } = {},
) {
  const { message } = await api.post<{ message: Message }>(`/threads/${threadId}/messages`, {
    text: text.trim(),
    attachments: attachments.map(({ path, name, size }) => ({ path, name, size })),
    confirmOffPlatform: opts.confirmOffPlatform,
  });
  queryClient.setQueryData<Message[]>(['live', `messages:${threadId}`], (cur) => (cur && !cur.some((m) => m.id === message.id) ? [...cur, message] : cur));
  return message;
}

/** Clears this person's unread count and stamps their read time. */
export function markThreadRead(threadId: string, _uid: string) {
  return api.post(`/threads/${threadId}/read`);
}

export function useIncomingConnections(uid: string | null) {
  return useLive<Connection[]>(uid ? 'connections' : null, ['in', uid], async () => (await api.get<{ connections: Connection[] }>('/connections?as=in')).connections, []);
}

export function useOutgoingConnections(uid: string | null) {
  return useLive<Connection[]>(uid ? 'connections' : null, ['out', uid], async () => (await api.get<{ connections: Connection[] }>('/connections?as=out')).connections, []);
}

export const sendConnectRequest = (data: { freelancerUid: string; message: string; projectId?: string; brief?: string }) =>
  api.post<{ connectionId: string }>('/connections', data);
export const respondToConnection = (data: { connectionId: string; action: 'accept' | 'decline' | 'block'; reason?: DeclineReason; referTo?: string }) =>
  api.post<{ status: string; threadId?: string }>(`/connections/${data.connectionId}/respond`, { action: data.action, reason: data.reason, referTo: data.referTo });
export const blockUser = (data: { targetUid: string }) => api.post<{ blocked: boolean }>('/blocks', data);
export const markHire = (data: { freelancerUid: string; projectId?: string }) => api.post<{ hireId: string }>('/hires', data);
export const createReview = (data: { hireId: string; rating: number; text: string }) => api.post<{ reviewId: string }>('/reviews', data);
export const replyToReview = (data: { reviewId: string; text: string }) => api.post<{ replied: boolean }>(`/reviews/${data.reviewId}/reply`, { text: data.text });
export const openProposalThread = (data: { proposalId: string }) => api.post<{ threadId: string }>(`/proposals/${data.proposalId}/open-thread`);

export type { DeclineReason } from '@/types';
export { toMillis };
