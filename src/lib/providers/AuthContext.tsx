import { writeCachedRole } from '@/lib/roleCache';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/data/api';
import { queryClient } from '@/lib/queryClient';
import { useLiveConnection } from '@/lib/data/live';
import type { Role } from '@/types';

/** The signed-in person, as the server describes them. */
export interface AuthUser {
  uid: string;
  email: string;
  name: string;
}

interface SessionResponse {
  user: { id: string; email: string; role: Role; isAdmin: boolean; name?: string } | null;
}

export interface SignInModalOptions {
  /** Runs once, with the new user's uid, after a successful sign-in or sign-up. */
  onSuccess?: (uid: string) => void;
  mode?: 'signin' | 'signup';
  reason?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  role: Role | null;
  isAdmin: boolean;
  /** True until the first session check has finished. */
  isAuthLoading: boolean;
  signIn: (email: string, pass: string) => Promise<AuthUser>;
  signUp: (email: string, pass: string, role: 'client' | 'freelancer', name: string) => Promise<AuthUser>;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resolved, setResolved] = useState(false);

  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<SignInModalOptions>({});
  const pendingRef = useRef<((uid: string) => void) | null>(null);

  const apply = useCallback((session: SessionResponse['user']): AuthUser | null => {
    if (!session) {
      setCurrentUser(null);
      setRole(null);
      setIsAdmin(false);
      return null;
    }
    const user = { uid: session.id, email: session.email, name: session.name ?? '' };
    setCurrentUser(user);
    setRole(session.role);
    setIsAdmin(session.isAdmin);
    return user;
  }, []);

  // Restore the session on load.
  useEffect(() => {
    let cancelled = false;
    api
      .get<SessionResponse>('/auth/me')
      .then((res) => !cancelled && apply(res.user))
      .catch(() => !cancelled && apply(null))
      .finally(() => !cancelled && setResolved(true));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  useLiveConnection(currentUser !== null);

  // Remember the role so the header can render the right links on the next first paint.
  useEffect(() => {
    if (!resolved) return;
    writeCachedRole(currentUser ? (isAdmin ? 'admin' : role) : null);
  }, [resolved, currentUser, role, isAdmin]);

  const signIn = useCallback(
    async (email: string, pass: string) => {
      const res = await api.post<SessionResponse>('/auth/signin', { email, password: pass });
      queryClient.clear();
      return apply(res.user)!;
    },
    [apply],
  );

  const signUp = useCallback(
    async (email: string, pass: string, newRole: 'client' | 'freelancer', name: string) => {
      const res = await api.post<SessionResponse>('/auth/signup', {
        email,
        password: pass,
        role: newRole,
        name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      queryClient.clear();
      return apply(res.user)!;
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    await api.post('/auth/signout').catch(() => undefined);
    apply(null);
    queryClient.clear();
  }, [apply]);

  const resetPassword = useCallback(async (email: string) => {
    await api.post('/auth/reset-request', { email });
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
      isAuthLoading: !resolved,
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
    [currentUser, role, isAdmin, resolved, signIn, signUp, signOut, resetPassword, isSignInModalOpen, modalOptions, openSignInModal, closeSignInModal, completeSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
