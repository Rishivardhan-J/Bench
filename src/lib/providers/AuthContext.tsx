import { writeCachedRole } from '@/lib/roleCache';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { callable } from '@/lib/data/api';
import type { Role } from '@/types';

export interface SignInModalOptions {
  /** Runs once, with the new user's uid, after a successful sign-in or sign-up. */
  onSuccess?: (uid: string) => void;
  mode?: 'signin' | 'signup';
  reason?: string;
}

interface AuthContextType {
  currentUser: User | null;
  role: Role | null;
  isAdmin: boolean;
  /** True until the auth state and the user's role record have both resolved. */
  isAuthLoading: boolean;
  signIn: (email: string, pass: string) => Promise<User>;
  signUp: (email: string, pass: string, role: 'client' | 'freelancer', name: string) => Promise<User>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isSignInModalOpen: boolean;
  modalOptions: SignInModalOptions;
  openSignInModal: (options?: SignInModalOptions) => void;
  closeSignInModal: () => void;
  /** Called by the modal after success so queued work can run. */
  completeSignIn: (uid: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initAccount = callable<{ role: 'client' | 'freelancer'; name: string; timezone: string }, { role: Role }>('initAccount');

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);

  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<SignInModalOptions>({});
  const pendingRef = useRef<((uid: string) => void) | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthResolved(true);
      if (!user) {
        setRole(null);
        setIsAdmin(false);
        setRoleResolved(true);
        return;
      }
      setRoleResolved(false);
      try {
        const token = await user.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } catch {
        setIsAdmin(false);
      }
    });
  }, []);

  // The role record is created by a Cloud Function right after sign-up, so listen rather than read once.
  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snap) => {
        setRole(snap.exists() ? (snap.data().role as Role) : null);
        if (snap.exists()) setRoleResolved(true);
      },
      () => setRoleResolved(true),
    );
  }, [currentUser]);

  // Remember the role so the header can render the right links on the next first paint.
  useEffect(() => {
    if (!authResolved) return;
    if (!currentUser) writeCachedRole(null);
    else if (roleResolved) writeCachedRole(isAdmin ? 'admin' : role);
  }, [authResolved, currentUser, roleResolved, role, isAdmin]);

  // A signed-in account with no role record (e.g. mid sign-up) must not hang the app.
  useEffect(() => {
    if (!currentUser || roleResolved) return;
    const t = window.setTimeout(() => setRoleResolved(true), 4000);
    return () => window.clearTimeout(t);
  }, [currentUser, roleResolved]);

  const signIn = useCallback(async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  }, []);

  const signUp = useCallback(async (email: string, pass: string, newRole: 'client' | 'freelancer', name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    try {
      await initAccount({ role: newRole, name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    } catch (err) {
      // Roll back so the email is not left registered without a role.
      await cred.user.delete().catch(() => undefined);
      throw err;
    }
    return cred.user;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const openSignInModal = useCallback((options: SignInModalOptions = {}) => {
    pendingRef.current = options.onSuccess ?? null;
    setModalOptions(options);
    setIsSignInModalOpen(true);
  }, []);

  const closeSignInModal = useCallback(() => {
    pendingRef.current = null;
    setIsSignInModalOpen(false);
  }, []);

  const completeSignIn = useCallback((uid: string) => {
    const action = pendingRef.current;
    pendingRef.current = null;
    setIsSignInModalOpen(false);
    if (action) window.setTimeout(() => action(uid), 0);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      currentUser,
      role,
      isAdmin,
      isAuthLoading: !authResolved || (currentUser !== null && !roleResolved),
      signIn,
      signUp,
      signOut,
      resetPassword,
      isSignInModalOpen,
      modalOptions,
      openSignInModal,
      closeSignInModal,
      completeSignIn,
    }),
    [currentUser, role, isAdmin, authResolved, roleResolved, signIn, signUp, signOut, resetPassword, isSignInModalOpen, modalOptions, openSignInModal, closeSignInModal, completeSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
