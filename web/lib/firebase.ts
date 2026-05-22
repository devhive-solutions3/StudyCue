/**
 * Convenience re-export; all symbols are safe only inside client components
 * (`firebase-client` is marked `'use client'`).
 */
export {
  WebAuthProvider,
  useWebAuth,
  signInGooglePopup,
  signInEmail,
  registerEmail,
  sendPasswordReset,
  deleteMirrorDocument,
  deleteAccount,
  deleteGoogleAccount,
  getFirebaseDb,
} from './firebase-client';
