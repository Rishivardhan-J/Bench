import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/data/api';
import { useLive } from '@/lib/data/live';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from './AuthContext';
import { useToast } from '@/components/ui/Toast';
import type { ShortlistList } from '@/types';

const DEFAULT_LIST_NAME = 'Shortlist';

interface ShortlistContextType {
  lists: ShortlistList[];
  isLoading: boolean;
  savedIds: Set<string>;
  isSaved: (freelancerId: string) => boolean;
  /** One entry point for every save button: handles sign-in, role and the list picker. */
  requestSave: (freelancerId: string) => void;
  pickerFor: string | null;
  closePicker: () => void;
  addToList: (listId: string, freelancerId: string) => Promise<void>;
  removeFromList: (listId: string, freelancerId: string) => Promise<void>;
  createList: (name: string, firstFreelancerId?: string) => Promise<string>;
  renameList: (listId: string, name: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  setNote: (listId: string, freelancerId: string, note: string) => Promise<void>;
  moveItem: (listId: string, from: number, to: number) => Promise<void>;
  /** Creates (or returns) a read-only link token for a list. */
  shareList: (listId: string) => Promise<string>;
  unshareList: (listId: string) => Promise<void>;
}

const ShortlistContext = createContext<ShortlistContextType | undefined>(undefined);

export const ShortlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, role, openSignInModal } = useAuth();
  const { toast } = useToast();
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const uid = currentUser?.uid ?? null;
  const isClient = role === 'client';

  const { data: lists, loading: isLoading } = useLive<ShortlistList[]>(
    uid && isClient ? 'shortlists' : null,
    [uid],
    async () => (await api.get<{ lists: ShortlistList[] }>('/shortlists')).lists,
    [],
  );

  const savedIds = useMemo(() => new Set(lists.flatMap((l) => l.items.map((i) => i.freelancerId))), [lists]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['live', 'shortlists'] });

  const createList = useCallback(
    async (name: string, firstFreelancerId?: string) => {
      if (!uid) throw new Error('Not signed in');
      const { id } = await api.post<{ id: string }>('/shortlists', { name: name.trim().slice(0, 60), freelancerId: firstFreelancerId });
      await refresh();
      return id;
    },
    [uid],
  );

  const addToList = useCallback(async (listId: string, freelancerId: string) => {
    await api.put(`/shortlists/${listId}/items/${freelancerId}`);
    await refresh();
  }, []);

  const removeFromList = useCallback(async (listId: string, freelancerId: string) => {
    await api.del(`/shortlists/${listId}/items/${freelancerId}`);
    await refresh();
  }, []);

  const setNote = useCallback(async (listId: string, freelancerId: string, note: string) => {
    await api.patch(`/shortlists/${listId}/items/${freelancerId}`, { note: note.slice(0, 500) });
    await refresh();
  }, []);

  const moveItem = useCallback(async (listId: string, from: number, to: number) => {
    await api.post(`/shortlists/${listId}/move`, { from, to });
    await refresh();
  }, []);

  const renameList = useCallback(async (listId: string, name: string) => {
    await api.patch(`/shortlists/${listId}`, { name: name.trim().slice(0, 60) });
    await refresh();
  }, []);

  const deleteList = useCallback(async (listId: string) => {
    await api.del(`/shortlists/${listId}`);
    await refresh();
  }, []);

  const shareList = useCallback(async (listId: string) => {
    const { token } = await api.post<{ token: string }>(`/shortlists/${listId}/share`);
    await refresh();
    return token;
  }, []);

  const unshareList = useCallback(async (listId: string) => {
    await api.del(`/shortlists/${listId}/share`);
    await refresh();
  }, []);

  const quickSave = useCallback(
    async (freelancerId: string) => {
      try {
        if (lists.length === 0) {
          await createList(DEFAULT_LIST_NAME, freelancerId);
          toast(`Saved to ${DEFAULT_LIST_NAME}`);
        } else {
          const target = lists[0];
          await addToList(target.id, freelancerId);
          toast(`Saved to ${target.name}`);
        }
      } catch (error) {
        console.error('Failed to save to shortlist', error);
        toast("Couldn't save that. Please try again.");
      }
    },
    [lists, createList, addToList, toast],
  );

  const [afterAuth, setAfterAuth] = useState<string | null>(null);

  const requestSave = useCallback(
    (freelancerId: string) => {
      if (!currentUser) {
        openSignInModal({
          mode: 'signup',
          reason: 'Create a free client account to save freelancers to a shortlist.',
          // The queued save runs once the new role record exists.
          onSuccess: () => setAfterAuth(freelancerId),
        });
        return;
      }
      if (!isClient) {
        toast('Shortlists are available on client accounts.');
        return;
      }
      if (savedIds.has(freelancerId)) setPickerFor(freelancerId);
      else void quickSave(freelancerId);
    },
    [currentUser, isClient, savedIds, quickSave, openSignInModal, toast],
  );

  // Run the queued save once we know this is a client account with its lists loaded.
  useEffect(() => {
    if (afterAuth && isClient && !isLoading) {
      const id = afterAuth;
      setAfterAuth(null);
      if (!savedIds.has(id)) void quickSave(id);
    }
  }, [afterAuth, isClient, isLoading, savedIds, quickSave]);

  const value = useMemo<ShortlistContextType>(
    () => ({
      lists,
      isLoading,
      savedIds,
      isSaved: (id) => savedIds.has(id),
      requestSave,
      pickerFor,
      closePicker: () => setPickerFor(null),
      addToList,
      removeFromList,
      createList,
      renameList,
      deleteList,
      setNote,
      moveItem,
      shareList,
      unshareList,
    }),
    [lists, isLoading, savedIds, requestSave, pickerFor, addToList, removeFromList, createList, renameList, deleteList, setNote, moveItem, shareList, unshareList],
  );

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useShortlist = () => {
  const context = useContext(ShortlistContext);
  if (!context) throw new Error('useShortlist must be used within a ShortlistProvider');
  return context;
};
