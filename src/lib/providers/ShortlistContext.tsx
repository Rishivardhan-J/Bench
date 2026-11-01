import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toMillis } from '@/lib/data/api';
import { useAuth } from './AuthContext';
import { useToast } from '@/components/ui/Toast';
import type { ShortlistEntry, ShortlistList } from '@/types';

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
}

const ShortlistContext = createContext<ShortlistContextType | undefined>(undefined);

export const ShortlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, role, openSignInModal } = useAuth();
  const { toast } = useToast();
  const [lists, setLists] = useState<ShortlistList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const uid = currentUser?.uid ?? null;
  const isClient = role === 'client';

  useEffect(() => {
    if (!uid || !isClient) {
      setLists([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Realtime so a second tab stays in sync. Firestore applies local writes immediately.
    return onSnapshot(
      query(collection(db, 'shortlists', uid, 'lists'), orderBy('createdAt', 'asc')),
      (snap) => {
        setLists(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name as string,
              createdAt: toMillis(data.createdAt),
              items: ((data.items ?? []) as ShortlistEntry[]).map((i) => ({
                freelancerId: i.freelancerId,
                note: i.note ?? '',
                addedAt: toMillis(i.addedAt),
              })),
            };
          }),
        );
        setIsLoading(false);
      },
      (error) => {
        console.error('Shortlist listener failed', error);
        setIsLoading(false);
      },
    );
  }, [uid, isClient]);

  const savedIds = useMemo(() => new Set(lists.flatMap((l) => l.items.map((i) => i.freelancerId))), [lists]);

  const listRef = useCallback((listId: string) => doc(db, 'shortlists', uid ?? '_', 'lists', listId), [uid]);

  const mutateItems = useCallback(
    async (listId: string, fn: (items: ShortlistEntry[]) => ShortlistEntry[]) => {
      const ref = listRef(listId);
      await runTransaction(db, async (t) => {
        const snap = await t.get(ref);
        if (!snap.exists()) return;
        t.update(ref, { items: fn((snap.data().items ?? []) as ShortlistEntry[]) });
      });
    },
    [listRef],
  );

  const createList = useCallback(
    async (name: string, firstFreelancerId?: string) => {
      if (!uid) throw new Error('Not signed in');
      const items = firstFreelancerId ? [{ freelancerId: firstFreelancerId, note: '', addedAt: Date.now() }] : [];
      const ref = await addDoc(collection(db, 'shortlists', uid, 'lists'), {
        name: name.trim().slice(0, 60),
        items,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [uid],
  );

  const addToList = useCallback(
    (listId: string, freelancerId: string) =>
      mutateItems(listId, (items) =>
        items.some((i) => i.freelancerId === freelancerId) ? items : [...items, { freelancerId, note: '', addedAt: Date.now() }],
      ),
    [mutateItems],
  );

  const removeFromList = useCallback(
    (listId: string, freelancerId: string) => mutateItems(listId, (items) => items.filter((i) => i.freelancerId !== freelancerId)),
    [mutateItems],
  );

  const setNote = useCallback(
    (listId: string, freelancerId: string, note: string) =>
      mutateItems(listId, (items) => items.map((i) => (i.freelancerId === freelancerId ? { ...i, note: note.slice(0, 500) } : i))),
    [mutateItems],
  );

  const moveItem = useCallback(
    (listId: string, from: number, to: number) =>
      mutateItems(listId, (items) => {
        if (to < 0 || to >= items.length) return items;
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      }),
    [mutateItems],
  );

  const renameList = useCallback(
    (listId: string, name: string) => updateDoc(listRef(listId), { name: name.trim().slice(0, 60) }),
    [listRef],
  );

  const deleteList = useCallback((listId: string) => deleteDoc(listRef(listId)), [listRef]);

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
    }),
    [lists, isLoading, savedIds, requestSave, pickerFor, addToList, removeFromList, createList, renameList, deleteList, setNote, moveItem],
  );

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useShortlist = () => {
  const context = useContext(ShortlistContext);
  if (!context) throw new Error('useShortlist must be used within a ShortlistProvider');
  return context;
};
