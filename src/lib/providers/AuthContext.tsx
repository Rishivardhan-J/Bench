import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  isAuthLoading: boolean;
  signIn: (email: string, pass: string) => Promise<User>;
  signUp: (email: string, pass: string) => Promise<User>;
  signOut: () => Promise<void>;
  isSignInModalOpen: boolean;
  openSignInModal: (pendingAction?: () => void) => void;
  closeSignInModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      
      if (user && pendingAction) {
        pendingAction();
        setPendingAction(null);
        setIsSignInModalOpen(false);
      }
    });

    return unsubscribe;
  }, [pendingAction]);

  const signIn = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  };

  const signUp = async (email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    return cred.user;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const openSignInModal = (action?: () => void) => {
    if (action) setPendingAction(() => action);
    setIsSignInModalOpen(true);
  };

  const closeSignInModal = () => {
    setIsSignInModalOpen(false);
    setPendingAction(null);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthLoading,
      signIn,
      signUp,
      signOut,
      isSignInModalOpen,
      openSignInModal,
      closeSignInModal
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
