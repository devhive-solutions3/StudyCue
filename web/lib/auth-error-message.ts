type AuthErrorContext = 'login' | 'register' | 'google' | 'reset';

const MESSAGES: Record<string, Partial<Record<AuthErrorContext, string>>> = {
  'auth/invalid-credential': {
    login:
      "That email or password doesn't match. Check for typos, or use Continue with Google if you signed up that way.",
    register: 'Could not create your account. Try a different email or sign up with Google.',
  },
  'auth/wrong-password': {
    login:
      "That password doesn't match this email. Try again or use Forgot password if you use email sign-in.",
  },
  'auth/user-not-found': {
    login:
      'No account found with that email. Create one below or sign in with Google if you used that before.',
  },
  'auth/invalid-email': {
    login: 'Enter a valid email address.',
    register: 'Enter a valid email address.',
    reset: 'Enter a valid email address.',
  },
  'auth/user-disabled': {
    login: 'This account is disabled. Contact support if you need help.',
    google: 'This account is disabled. Contact support if you need help.',
  },
  'auth/too-many-requests': {
    login: 'Too many attempts. Wait a few minutes, then try again.',
    google: 'Too many attempts. Wait a few minutes, then try again.',
    register: 'Too many attempts. Wait a few minutes, then try again.',
    reset: 'Too many attempts. Wait a few minutes, then try again.',
  },
  'auth/network-request-failed': {
    login: 'Network error. Check your connection and try again.',
    google: 'Network error. Check your connection and try again.',
    register: 'Network error. Check your connection and try again.',
    reset: 'Network error. Check your connection and try again.',
  },
  'auth/popup-blocked': {
    google: 'Your browser blocked the sign-in window. Allow pop-ups or try again on Safari with redirect.',
  },
  'auth/popup-closed-by-user': {
    google: 'Google sign-in was cancelled. Tap Continue with Google to try again.',
  },
  'auth/cancelled-popup-request': {
    google: 'Google sign-in was interrupted. Please try again.',
  },
  'auth/account-exists-with-different-credential': {
    login: 'This email is linked to another sign-in method. Try Google or the method you used when signing up.',
    google: 'This email already has an account with a different sign-in method. Try email/password instead.',
  },
  'auth/email-already-in-use': {
    register: 'An account with this email already exists. Log in or use Forgot password.',
  },
  'auth/weak-password': {
    register: 'Choose a stronger password (at least 6 characters).',
  },
  'auth/operation-not-allowed': {
    login: 'Email sign-in is not enabled for this app. Try Continue with Google.',
    register: 'Email sign-up is not available right now. Try Continue with Google.',
  },
};

const DEFAULTS: Record<AuthErrorContext, string> = {
  login: 'Could not sign you in. Please try again.',
  register: 'Could not create your account. Please try again.',
  google: 'Google sign-in did not complete. Please try again.',
  reset: 'Could not send a reset email. Please try again.',
};

function extractAuthErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string' && code.startsWith('auth/')) return code;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\(auth\/[^)]+\)/);
    if (match) return match[0].slice(1, -1);
  }
  return null;
}

/** User-facing copy for Firebase Auth failures (never show raw `Firebase: Error (...)`). */
export function authErrorMessage(error: unknown, context: AuthErrorContext): string {
  const code = extractAuthErrorCode(error);
  if (code) {
    const mapped = MESSAGES[code]?.[context] ?? MESSAGES[code]?.login;
    if (mapped) return mapped;
  }
  return DEFAULTS[context];
}
