import { errorMessage } from '@/lib/data/api';

interface MaybeFirebaseError {
  code?: string;
  message?: string;
}

/** Maps Firebase Auth, Firestore and callable errors to sentences a person can act on. */
export function getAuthErrorMessage(err: unknown): string {
  const e = (err ?? {}) as MaybeFirebaseError;

  switch (e.code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered. A client and a freelancer account cannot share an email, so use a different email for the other role.';
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return "Can't reach the server. Check your connection and try again.";
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'permission-denied':
      return 'Permission denied: could not sync your data. Try signing out and back in.';
  }

  if (e.message?.toLowerCase().includes('missing or insufficient permissions')) {
    return 'Permission denied: could not sync your data. Try signing out and back in.';
  }
  return errorMessage(err, 'Authentication failed. Please check your details and try again.');
}
