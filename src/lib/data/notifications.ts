import { collection, doc, limit, orderBy, query, updateDoc, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLiveCollection, useLiveDoc } from './live';
import { toMillis } from './api';
import type { AppNotification, NotificationPrefs } from '@/types';

export function useNotifications(uid: string | null) {
  return useLiveCollection<AppNotification>(
    uid ? `notifications:${uid}` : null,
    () => query(collection(db, 'notifications', uid!, 'items'), orderBy('createdAt', 'desc'), limit(50)),
    (d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        refId: data.refId ?? undefined,
        title: data.title,
        body: data.body,
        link: data.link,
        read: data.read === true,
        createdAt: toMillis(data.createdAt),
      };
    },
  );
}

export const markNotificationRead = (uid: string, id: string) =>
  updateDoc(doc(db, 'notifications', uid, 'items', id), { read: true });

export async function markAllNotificationsRead(uid: string, ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, 'notifications', uid, 'items', id), { read: true }));
  await batch.commit();
}

export const DEFAULT_PREFS: NotificationPrefs = {
  new_request: { inApp: true, email: true },
  request_accepted: { inApp: true, email: true },
  new_message: { inApp: true, email: true },
  proposal_received: { inApp: true, email: true },
};

export function useNotificationPrefs(uid: string | null) {
  const state = useLiveDoc<NotificationPrefs>(
    uid ? `prefs:${uid}` : null,
    () => doc(db, 'users', uid!, 'settings', 'prefs'),
    (d) => ({ ...DEFAULT_PREFS, ...(d.data() as Partial<NotificationPrefs>) }),
  );
  return { ...state, data: state.data ?? DEFAULT_PREFS };
}

export const savePrefs = (uid: string, prefs: NotificationPrefs) =>
  setDoc(doc(db, 'users', uid, 'settings', 'prefs'), prefs);
