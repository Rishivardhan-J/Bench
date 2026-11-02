import { api } from './api';
import { useLive } from './live';
import type { AppNotification, NotificationPrefs } from '@/types';

export function useNotifications(uid: string | null) {
  return useLive<AppNotification[]>(
    uid ? 'notifications' : null,
    [uid],
    async () => (await api.get<{ notifications: AppNotification[] }>('/notifications')).notifications,
    [],
  );
}

export const markNotificationRead = (_uid: string, id: string) => api.post('/notifications/read', { ids: [id] });

export const markAllNotificationsRead = (_uid: string, ids: string[]) => api.post('/notifications/read', { ids });

export const DEFAULT_PREFS: NotificationPrefs = {
  new_request: { inApp: true, email: true },
  request_accepted: { inApp: true, email: true },
  new_message: { inApp: true, email: true },
  proposal_received: { inApp: true, email: true },
};

export function useNotificationPrefs(uid: string | null) {
  const state = useLive<NotificationPrefs | null>(
    uid ? 'prefs' : null,
    [uid],
    async () => ({ ...DEFAULT_PREFS, ...(await api.get<{ prefs: Partial<NotificationPrefs> }>('/notification-prefs')).prefs }),
    null,
  );
  return { ...state, data: state.data ?? DEFAULT_PREFS };
}

export const savePrefs = (_uid: string, prefs: NotificationPrefs) => api.put('/notification-prefs', prefs);
