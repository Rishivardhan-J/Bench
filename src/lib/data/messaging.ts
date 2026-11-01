import {
  addDoc,
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { callable, toMillis } from './api';
import { useLiveCollection } from './live';
import type { Attachment, Connection, Message, Thread } from '@/types';

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain';

function mapThread(d: { id: string; data: () => Record<string, unknown> }): Thread {
  const data = d.data();
  const lastRead = (data.lastRead ?? {}) as Record<string, unknown>;
  return {
    id: d.id,
    participants: data.participants as string[],
    names: (data.names ?? {}) as Record<string, string>,
    connectionId: data.connectionId as string,
    lastMessageAt: toMillis(data.lastMessageAt),
    lastMessage: data.lastMessage as string | undefined,
    unread: (data.unread ?? {}) as Record<string, number>,
    lastRead: Object.fromEntries(Object.entries(lastRead).map(([k, v]) => [k, toMillis(v) ?? 0])),
    closed: data.closed === true,
    hireId: data.hireId as string | undefined,
  };
}

export function useThreads(uid: string | null) {
  return useLiveCollection<Thread>(
    uid ? `threads:${uid}` : null,
    () => query(collection(db, 'threads'), where('participants', 'array-contains', uid!), orderBy('lastMessageAt', 'desc'), limit(100)),
    mapThread,
  );
}

export function useMessages(threadId: string | null) {
  return useLiveCollection<Message>(
    threadId ? `messages:${threadId}` : null,
    () => query(collection(db, 'threads', threadId!, 'messages'), orderBy('createdAt', 'asc'), limit(500)),
    (d) => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return {
        id: d.id,
        senderUid: data.senderUid,
        text: data.text ?? '',
        attachments: (data.attachments ?? []) as Attachment[],
        createdAt: toMillis(data.createdAt),
        pending: d.metadata.hasPendingWrites,
      };
    },
  );
}

export async function uploadAttachment(threadId: string, file: File): Promise<Attachment> {
  const safe = file.name.replace(/[^\w.\- ]/g, '_').slice(-80);
  const path = `attachments/${threadId}/${Date.now()}_${safe}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return { name: file.name.slice(0, 120), path, url: await getDownloadURL(r), type: file.type, size: file.size };
}

export function sendMessage(threadId: string, senderUid: string, text: string, attachments: Attachment[] = []) {
  return addDoc(collection(db, 'threads', threadId, 'messages'), {
    senderUid,
    text: text.trim(),
    attachments,
    createdAt: serverTimestamp(),
  });
}

/** Clears this person's unread count and stamps their read time (the only thread fields clients may write). */
export function markThreadRead(threadId: string, uid: string) {
  return updateDoc(doc(db, 'threads', threadId), { [`unread.${uid}`]: 0, [`lastRead.${uid}`]: serverTimestamp() });
}

function mapConnection(d: { id: string; data: () => Record<string, unknown> }): Connection {
  const data = d.data();
  return {
    id: d.id,
    clientUid: data.clientUid as string,
    freelancerUid: data.freelancerUid as string,
    clientName: data.clientName as string | undefined,
    freelancerName: data.freelancerName as string | undefined,
    projectId: (data.projectId as string | null) ?? undefined,
    projectTitle: (data.projectTitle as string | null) ?? undefined,
    briefText: (data.briefText as string | null) ?? undefined,
    firstMessage: data.firstMessage as string,
    status: data.status as Connection['status'],
    threadId: data.threadId as string | undefined,
    createdAt: toMillis(data.createdAt),
  };
}

export function useIncomingConnections(uid: string | null) {
  return useLiveCollection<Connection>(
    uid ? `conn-in:${uid}` : null,
    () => query(collection(db, 'connections'), where('freelancerUid', '==', uid!), orderBy('createdAt', 'desc'), limit(100)),
    mapConnection,
  );
}

export function useOutgoingConnections(uid: string | null) {
  return useLiveCollection<Connection>(
    uid ? `conn-out:${uid}` : null,
    () => query(collection(db, 'connections'), where('clientUid', '==', uid!), orderBy('createdAt', 'desc'), limit(100)),
    mapConnection,
  );
}

export const sendConnectRequest = callable<{ freelancerUid: string; message: string; projectId?: string; brief?: string }, { connectionId: string }>('sendConnectRequest');
export const respondToConnection = callable<{ connectionId: string; action: 'accept' | 'decline' | 'block' }, { status: string; threadId?: string }>('respondToConnection');
export const blockUser = callable<{ targetUid: string }, { blocked: boolean }>('blockUser');
export const markHire = callable<{ freelancerUid: string; projectId?: string }, { hireId: string }>('markHire');
export const createReview = callable<{ hireId: string; rating: number; text: string }, { reviewId: string }>('createReview');
export const replyToReview = callable<{ reviewId: string; text: string }, { replied: boolean }>('replyToReview');
export const openProposalThread = callable<{ proposalId: string }, { threadId: string }>('openProposalThread');

