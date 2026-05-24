'use client';

import { getApps, initializeApp } from 'firebase/app';
import {
  type User as FirebaseUser,
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  fetchSignInMethodsForEmail,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  reload,
  setPersistence,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getFirebasePublicConfig } from '@/lib/public-env';
import { saveLocalProfilePhoto } from '@/lib/local-file-store';

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SIGNED_IN_AT_KEY = 'studycue.web.signedInAt';
const REMEMBER_ME_KEY = 'studycue.web.rememberMe';
const REMEMBERED_EMAIL_KEY = 'studycue.web.rememberedEmail';
const IS_DEV = process.env.NODE_ENV !== 'production';

async function readResponseError(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    }
    const text = (await res.text()).trim();
    if (text) return text;
  } catch {
    /* noop */
  }
  return `HTTP ${res.status}`;
}

function readSignedInAt(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SIGNED_IN_AT_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

function writeSignedInAt(ts: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIGNED_IN_AT_KEY, String(ts));
}

function clearSignedInAt() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SIGNED_IN_AT_KEY);
}

export function readRememberMe(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(REMEMBER_ME_KEY);
  return raw === null ? true : raw !== 'false';
}

export function writeRememberMe(remember: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
}

export function readRememberedEmail(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
}

export function writeRememberedEmail(email: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
}

export function clearRememberedEmail() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

export async function setAuthPersistence(rememberMe: boolean) {
  const { auth } = getFirebase();
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
}

export type FirebaseUserLite = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerIds: string[];
};

export function getProviderIds(user: Pick<FirebaseUserLite, 'providerIds'> | FirebaseUser | null | undefined): string[] {
  if (!user) return [];
  if ('providerIds' in user) return Array.isArray(user.providerIds) ? user.providerIds : [];
  return user.providerData.map((provider) => provider.providerId).filter(Boolean);
}

export function hasPasswordProvider(user: Pick<FirebaseUserLite, 'providerIds'> | FirebaseUser | null | undefined): boolean {
  return getProviderIds(user).includes('password');
}

export function hasGoogleProvider(user: Pick<FirebaseUserLite, 'providerIds'> | FirebaseUser | null | undefined): boolean {
  return getProviderIds(user).includes('google.com');
}

type AuthCtx = {
  ready: boolean;
  authLoading: boolean;
  user: FirebaseUserLite | null;
  logout: () => Promise<void>;
  /** Post-login cookie for middleware */
  syncSessionCookie: (userOverride?: SessionUser) => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

type SessionUser = Pick<FirebaseUser, 'uid' | 'getIdToken'>;

let appInstance: ReturnType<typeof initializeApp> | null = null;

function getFirebase(): { app: NonNullable<typeof appInstance>; auth: ReturnType<typeof getAuth> } {
  if (typeof window === 'undefined') throw new Error('Firebase client only');

  const fallback = {
    apiKey: 'AIzaSyDhU0u21HwVeyush_UdPDKNBUj2ge6iLhk',
    authDomain: 'studycue-3d831.firebaseapp.com',
    projectId: 'studycue-3d831',
    storageBucket: 'studycue-3d831.firebasestorage.app',
    messagingSenderId: '93901303504',
    appId: '1:93901303504:web:7d648c5caaa094272df8d5',
  } as const;

  const fromEnv = getFirebasePublicConfig();
  const config = {
    apiKey: (fromEnv.apiKey || fallback.apiKey).trim(),
    authDomain: (fromEnv.authDomain || fallback.authDomain).trim(),
    projectId: (fromEnv.projectId || fallback.projectId).trim(),
    storageBucket: (fromEnv.storageBucket || fallback.storageBucket).trim(),
    messagingSenderId: (fromEnv.messagingSenderId || fallback.messagingSenderId).trim(),
    appId: (fromEnv.appId || fallback.appId).trim(),
  };

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.storageBucket || !config.messagingSenderId || !config.appId) {
    throw new Error('Missing EXPO_PUBLIC_FIREBASE_* (or NEXT_PUBLIC_FIREBASE_*) env vars');
  }

  appInstance ||= getApps()[0] ?? initializeApp(config);
  const auth = getAuth(appInstance);

  return { app: appInstance, auth };
}

export function getFirebaseDb() {
  const { app } = getFirebase();
  return getFirestore(app);
}

export function getFirebaseStorage() {
  const { app } = getFirebase();
  return getStorage(app);
}

const Ctx = createContext<AuthCtx | null>(null);

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<FirebaseUserLite | null>(null);

  const getIdToken = useCallback(async () => {
    const { auth } = getFirebase();
    const u = auth.currentUser;
    if (!u) return null;
    return u.getIdToken();
  }, []);

  const postSessionCookie = useCallback(async (token: string) => {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const detail = await readResponseError(res);
      if (IS_DEV) console.warn('Session cookie sync failed', { status: res.status, detail });
      throw new Error(`Session cookie sync failed (${res.status})`);
    }
    if (IS_DEV) console.info('Session cookie sync succeeded', { status: res.status });
  }, []);

  const syncSessionCookie = useCallback(async (userOverride?: SessionUser) => {
    const { auth } = getFirebase();
    const u = userOverride ?? auth.currentUser;
    if (!u) return;
    const token = await u.getIdToken(true);
    if (IS_DEV) console.info('Firebase ID token obtained for session sync', { uid: u.uid });
    await postSessionCookie(token);
  }, [postSessionCookie]);

  const logout = useCallback(async () => {
    const { auth } = getFirebase();
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
    await signOut(auth);
    clearSignedInAt();
    setUser(null);
  }, []);

  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { auth } = getFirebase();

    const clearExpiryTimer = () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };

    const forceLogout = async () => {
      try {
        await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
      } catch {
        /* noop */
      }
      try {
        await signOut(auth);
      } catch {
        /* noop */
      }
      clearSignedInAt();
      setUser(null);
    };

    const unsub = auth.onAuthStateChanged(async (u) => {
      clearExpiryTimer();
      if (u) {
        const existingStart = readSignedInAt();
        const startedAt = existingStart ?? Date.now();
        if (!existingStart) writeSignedInAt(startedAt);

        const elapsed = Date.now() - startedAt;
        if (elapsed >= SESSION_MAX_AGE_MS) {
          await forceLogout();
          setReady(true);
          return;
        }

        setUser({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          providerIds: u.providerData.map((p) => p.providerId),
        });

        try {
          const token = await u.getIdToken(true);
          await postSessionCookie(token);
        } catch (e) {
          if (IS_DEV) console.warn('Session cookie refresh failed', e);
        }

        const remaining = SESSION_MAX_AGE_MS - elapsed;
        expiryTimerRef.current = setTimeout(() => {
          void forceLogout();
        }, remaining);
      } else {
        clearSignedInAt();
        setUser(null);
      }
      setReady(true);
    });

    return () => {
      clearExpiryTimer();
      unsub();
    };
  }, [postSessionCookie]);

  const value = useMemo(
    () => ({ ready, authLoading: !ready, user, logout, syncSessionCookie, getIdToken }),
    [ready, user, logout, syncSessionCookie, getIdToken],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWebAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWebAuth must be inside WebAuthProvider');
  return ctx;
}

/** Mobile Safari / in-app browsers block popups; COOP breaks Firebase popup polling. */
export function shouldUseGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true;
  if (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua)) return true;
  return false;
}

export async function signInGoogleRedirect() {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  auth.languageCode = 'en';
  const { signInWithRedirect } = await import('firebase/auth');
  await signInWithRedirect(auth, provider);
}

export async function signInGooglePopup() {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();
  auth.languageCode = 'en';
  const { signInWithPopup } = await import('firebase/auth');
  const result = await signInWithPopup(auth, provider);
  if (IS_DEV) console.info('Firebase Google popup sign-in succeeded', { uid: result.user.uid });
  return result.user;
}

/** Popup on desktop; redirect on mobile/Safari (and when popup is blocked). */
export async function signInGoogleWeb(): Promise<
  { mode: 'popup-complete'; user: FirebaseUser } | { mode: 'redirect-started'; user: null }
> {
  if (shouldUseGoogleRedirect()) {
    await signInGoogleRedirect();
    return { mode: 'redirect-started', user: null };
  }
  try {
    const user = await signInGooglePopup();
    return { mode: 'popup-complete', user };
  } catch (e) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInGoogleRedirect();
      return { mode: 'redirect-started', user: null };
    }
    throw e;
  }
}

/** Call once on login/register mount after returning from Google OAuth redirect. */
export async function completeGoogleRedirectSignIn(): Promise<boolean> {
  const { auth } = getFirebase();
  const { getRedirectResult } = await import('firebase/auth');
  const result = await getRedirectResult(auth);
  if (result?.user && IS_DEV) console.info('Firebase Google redirect sign-in succeeded', { uid: result.user.uid });
  return !!result?.user;
}

export async function signInEmail(email: string, password: string) {
  const { auth } = getFirebase();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  if (IS_DEV) console.info('Firebase email sign-in succeeded', { uid: cred.user.uid });
  return cred.user;
}

export async function lookupSignInMethods(email: string): Promise<string[]> {
  const { auth } = getFirebase();
  return fetchSignInMethodsForEmail(auth, email.trim());
}

export async function registerEmail(email: string, password: string, displayName: string) {
  const { auth } = getFirebase();
  const { createUserWithEmailAndPassword, updateProfile } = await import(
    'firebase/auth',
  );
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  if (IS_DEV) console.info('Firebase email registration succeeded', { uid: cred.user.uid });
  return cred.user;
}

export async function sendPasswordReset(email: string) {
  const { auth } = getFirebase();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  // TODO: add explicit actionCodeSettings only when the production return URL is fully configured in Firebase Auth.
  await sendPasswordResetEmail(auth, email);
}

export async function deleteMirrorDocument(uid: string) {
  const { deleteDoc, doc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'users', uid, 'mirror', 'snapshot'));
}

export async function deleteGoogleAccount() {
  const { auth } = getFirebase();
  const { GoogleAuthProvider, deleteUser, reauthenticateWithPopup } = await import('firebase/auth');
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const isGoogle = user.providerData.some((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID);
  if (!isGoogle) throw new Error('This shortcut is only for Google sign-in accounts.');

  await reauthenticateWithPopup(user, new GoogleAuthProvider());
  const uid = user.uid;
  await deleteMirrorDocument(uid);
  await deleteUser(user);
  await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
}

export async function deleteAccount(password: string) {
  const { auth } = getFirebase();
  const { EmailAuthProvider, deleteUser, reauthenticateWithCredential } = await import('firebase/auth');
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in with email/password');

  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  const uid = user.uid;
  await deleteMirrorDocument(uid);
  await deleteUser(user);
  await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
}

/**
 * Schedule account deletion with a 30-day grace period.
 * Marks the user's Firestore doc and signs them out.
 * A backend job (Cloud Function) should clean up accounts past scheduledDeletionAt.
 * Signing back in within 30 days cancels the deletion.
 */
export async function scheduleAccountDeletion(password?: string) {
  const { auth } = getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  if (password) {
    const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
    if (!user.email) throw new Error('No email on account');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }

  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const db = getFirebaseDb();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await setDoc(
    doc(db, 'users', user.uid, 'meta', 'deletion'),
    { scheduledAt: serverTimestamp(), scheduledDeletionAt: thirtyDaysFromNow, uid: user.uid },
    { merge: true },
  );

  await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export async function cancelAccountDeletion(uid: string) {
  const { doc, deleteDoc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'users', uid, 'meta', 'deletion'));
}

export async function getScheduledDeletion(uid: string): Promise<{ scheduledDeletionAt: string } | null> {
  const { doc, getDoc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'deletion'));
  if (!snap.exists()) return null;
  return snap.data() as { scheduledDeletionAt: string };
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { auth } = getFirebase();
  const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in with email/password');

  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}

export async function addPasswordLogin(newPassword: string) {
  const { auth } = getFirebase();
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Your account needs an email address before a password can be added.');

  await linkWithCredential(user, EmailAuthProvider.credential(user.email, newPassword));
  await reload(user);
  return user;
}

export async function linkGoogleLogin() {
  const { auth } = getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const provider = new GoogleAuthProvider();
  auth.languageCode = 'en';
  const result = await linkWithPopup(user, provider);
  await reload(result.user);
  return result.user;
}

export async function uploadProfilePic(file: File): Promise<string> {
  const { auth } = getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const { compressProfilePhoto } = await import('@/lib/upload-limits');
  const avatarBlob = await compressProfilePhoto(file);

  let photoUrl: string;
  if (process.env.NEXT_PUBLIC_FILE_STORAGE_MODE !== 'firebase') {
    const compressedFile = new File([avatarBlob], 'avatar.jpg', { type: 'image/jpeg' });
    photoUrl = await saveLocalProfilePhoto(user.uid, compressedFile);
  } else {
    const storage = getFirebaseStorage();
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { updateProfile } = await import('firebase/auth');

    const storageRef = ref(storage, `${user.uid}/pfp/avatar.jpg`);
    await uploadBytes(storageRef, avatarBlob, { contentType: 'image/jpeg' });
    photoUrl = await getDownloadURL(storageRef);
    await updateProfile(user, { photoURL: photoUrl });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('studycue-profile-photo-changed'));
  }
  return photoUrl;
}
