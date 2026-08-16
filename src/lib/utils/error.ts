export function getAuthErrorMessage(err: any): string {
  // If it's a known Firebase Auth error code
  if (err?.code === 'auth/email-already-in-use') {
    return "That email is already registered. If you have an account in the other role, you must use a different email.";
  }
  if (err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
    return "Invalid email or password. Please try again.";
  }
  if (err?.code === 'auth/weak-password') {
    return "Password should be at least 6 characters.";
  }
  if (err?.code === 'auth/invalid-email') {
    return "Please enter a valid email address.";
  }
  if (err?.code === 'auth/operation-not-allowed') {
    return "This sign-in method is not enabled. Please contact support.";
  }
  
  // If it's a Firestore permission denied error
  if (err?.code === 'permission-denied' || err?.message?.toLowerCase().includes('missing or insufficient permissions')) {
    return "Permission denied: Could not sync your data. Please try signing out and signing in again.";
  }

  // Fallback to the raw error message to make the real issue visible
  return err?.message || "Authentication failed. Please check your details and try again.";
}
