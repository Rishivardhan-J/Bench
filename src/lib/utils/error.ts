import { errorMessage } from '@/lib/data/api';

/** Sign-in and sign-up errors already arrive from the server as sentences; this only supplies a fallback. */
export function getAuthErrorMessage(err: unknown): string {
  return errorMessage(err, 'Authentication failed. Please check your details and try again.');
}
