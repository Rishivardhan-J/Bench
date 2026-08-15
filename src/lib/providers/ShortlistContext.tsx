import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { db, auth } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

interface ShortlistContextType {
  shortlisted: Set<string>;
  toggleShortlist: (id: string) => void;
}

const ShortlistContext = createContext<ShortlistContextType | undefined>(undefined);

export const ShortlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, openSignInModal } = useAuth();
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) {
      setShortlisted(new Set());
      return;
    }

    const shortlistsRef = collection(db, 'users', currentUser.uid, 'shortlists');
    
    // Real-time listener for multi-tab sync and accurate state
    const unsubscribe = onSnapshot(shortlistsRef, (snapshot) => {
      const newSet = new Set<string>();
      snapshot.forEach((doc) => {
        newSet.add(doc.id);
      });
      setShortlisted(newSet);
    }, (error) => {
      console.error("Error listening to shortlists:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const toggleShortlist = async (id: string) => {
    if (!currentUser) {
      // User is not signed in -> trigger sign in modal and queue the action
      openSignInModal(() => {
        // This will be called after successful sign in
        // Note: currentUser will be updated soon, but we need to pass the uid dynamically
        // Actually, we can rely on onAuthStateChanged in AuthContext to run the pending action
        // when `auth.currentUser` is available. Let's just execute the toggle directly 
        // using the auth instance to be safe, or just fire it and it'll pick up the context.
        // The safest way is to call the toggle again now that they are authed.
        // But since toggle relies on currentUser from state, it might be stale.
        // We can just rely on the fact that AuthContext awaits set state before calling pending.
        executeToggle(id);
      });
      return;
    }
    await executeToggle(id);
  };

  const executeToggle = async (id: string) => {
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (!uid) return;

    const docRef = doc(db, 'users', uid, 'shortlists', id);
    const isCurrentlySaved = shortlisted.has(id);

    // Optimistic local update
    setShortlisted(prev => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(id);
      else next.add(id);
      return next;
    });

    try {
      if (isCurrentlySaved) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          freelancerId: id,
          addedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Failed to toggle shortlist:", error);
      // Revert optimistic update
      setShortlisted(prev => {
        const next = new Set(prev);
        if (isCurrentlySaved) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };

  return (
    <ShortlistContext.Provider value={{ shortlisted, toggleShortlist }}>
      {children}
    </ShortlistContext.Provider>
  );
};

export const useShortlist = () => {
  const context = useContext(ShortlistContext);
  if (!context) {
    throw new Error('useShortlist must be used within a ShortlistProvider');
  }
  return context;
};
