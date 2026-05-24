'use client';

import Link from 'next/link';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import PasswordField from '@/components/forms/PasswordField';
import { authErrorMessage, getAuthErrorCode } from '@/lib/auth-error-message';
import { authRateLimitMessage, consumeAuthAttempt } from '@/lib/client-auth-rate-limit';
import {
  clearRememberedEmail,
  readRememberMe,
  readRememberedEmail,
  lookupSignInMethods,
  setAuthPersistence,
  completeGoogleRedirectSignIn,
  signInEmail,
  signInGoogleWeb,
  useWebAuth,
  writeRememberMe,
  writeRememberedEmail,
} from '@/lib/firebase-client';

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_DEV = process.env.NODE_ENV !== 'production';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted">Loading login...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = React.useMemo(() => normalizeNextPath(sp.get('next')), [sp]);
  const { ready, authLoading, user, syncSessionCookie } = useWebAuth();
  const redirectingRef = React.useRef(false);
  const initialRememberMe = React.useMemo(() => readRememberMe(), []);
  const initialEmail = React.useMemo(
    () => (initialRememberMe ? readRememberedEmail() : ''),
    [initialRememberMe],
  );

  const [email, setEmail] = React.useState(initialEmail);
  const [password, setPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(initialRememberMe);
  const [err, setErr] = React.useState<string | null>(null);
  const [busyGoogle, setBusyGoogle] = React.useState(false);
  const [busyEmail, setBusyEmail] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const signedIn = await completeGoogleRedirectSignIn();
        if (cancelled || !signedIn) return;
        if (IS_DEV) console.info('Firebase Google redirect login succeeded');
        persistRememberMe(rememberMe, email.trim());
        await syncSessionCookie();
        if (IS_DEV) console.info('/api/session sync completed after Google redirect');
        router.replace(next);
      } catch (e) {
        if (!cancelled) {
          if (IS_DEV) console.warn('/api/session sync failed after Google redirect', e);
          setErr(authErrorMessage(e, 'google'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on return from Google redirect
  }, []);

  React.useEffect(() => {
    if (!ready || authLoading || !user || redirectingRef.current) return;

    redirectingRef.current = true;
    void (async () => {
      try {
        if (IS_DEV) console.info('Firebase auth state ready; syncing secure session');
        await syncSessionCookie();
        if (IS_DEV) console.info('/api/session sync completed after auth state change');
        router.replace(next);
      } catch (e) {
        redirectingRef.current = false;
        if (IS_DEV) console.warn('/api/session sync failed after auth state change', e);
        setErr('Could not start your secure session. Please try again.');
      }
    })();
  }, [ready, authLoading, user, next, router, syncSessionCookie]);

  function persistRememberMe(value: boolean, emailValue: string) {
    writeRememberMe(value);
    if (value) {
      writeRememberedEmail(emailValue);
    } else {
      clearRememberedEmail();
    }
  }

  async function onGoogle() {
    setBusyGoogle(true);
    setErr(null);
    try {
      const rate = consumeAuthAttempt('login');
      if (!rate.allowed) {
        setErr(authRateLimitMessage(rate.retryAfterMs));
        return;
      }
      persistRememberMe(rememberMe, email.trim());
      await setAuthPersistence(rememberMe);
      const result = await signInGoogleWeb();
      if (result.mode === 'redirect-started') return;
      if (IS_DEV) console.info('Firebase Google popup login succeeded', { uid: result.user.uid });
      await syncSessionCookie(result.user);
      if (IS_DEV) console.info('/api/session sync completed after Google popup');
      router.replace(next);
    } catch (e) {
      if (IS_DEV) console.warn('/api/session sync failed after Google popup', e);
      setErr(authErrorMessage(e, 'google'));
    } finally {
      setBusyGoogle(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setErr('Enter your email and password.');
      return;
    }
    if (!SIMPLE_EMAIL_RE.test(trimmed) || trimmed.length > 254) {
      setErr('Enter a valid email address.');
      return;
    }
    const rate = consumeAuthAttempt('login');
    if (!rate.allowed) {
      setErr(authRateLimitMessage(rate.retryAfterMs));
      return;
    }
    setBusyEmail(true);
    try {
      persistRememberMe(rememberMe, trimmed);
      await setAuthPersistence(rememberMe);
      const signedInUser = await signInEmail(trimmed, password);
      if (IS_DEV) console.info('Firebase email login succeeded', { uid: signedInUser.uid });
      await syncSessionCookie(signedInUser);
      if (IS_DEV) console.info('/api/session sync completed after email login');
      router.replace(next);
    } catch (e) {
      if (IS_DEV) console.warn('Login or /api/session sync failed after email login', e);
      const code = getAuthErrorCode(e);
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        try {
          const methods = await lookupSignInMethods(trimmed);
          const hasPassword = methods.includes('password');
          const hasGoogle = methods.includes('google.com');

          if (hasGoogle && !hasPassword) {
            setErr('This email uses Google sign-in. Please continue with Google.');
          } else if (hasGoogle && hasPassword) {
            setErr("That email or password doesn't match. You can reset your password or continue with Google.");
          } else {
            setErr("That email or password doesn't match. Check your password or use Forgot password.");
          }
          return;
        } catch (lookupError) {
          if (IS_DEV) console.warn('Could not inspect sign-in methods after login failure', lookupError);
        }
      }
      setErr(authErrorMessage(e, 'login'));
    } finally {
      setBusyEmail(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100vh] w-full max-w-[420px] flex-col justify-center px-6 py-16">
      <div
        className="p-7"
        style={{
          background: 'var(--sc-surface)',
          border: '1px solid var(--sc-border)',
          borderRadius: 'var(--sc-radius-lg)',
          boxShadow: 'var(--sc-shadow-md)',
        }}
      >
        <h1
          className="text-center font-serif text-4xl leading-none"
          style={{ color: 'var(--sc-text-primary)' }}
        >
          Study<span style={{ color: 'var(--sc-accent)' }}>Cue</span>
        </h1>
        <p className="mt-3 text-center text-sm" style={{ color: 'var(--sc-text-secondary)' }}>
          Sign in to open your StudyCue dashboard on web.
        </p>

        {err ? (
          <p
            className="mt-6 px-3 py-3 text-xs"
            style={{
              background: 'var(--sc-danger-soft)',
              color: 'var(--sc-danger)',
              border: '1px solid var(--sc-border)',
              borderRadius: 'var(--sc-radius-sm)',
            }}
          >
            {err}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busyGoogle}
          onClick={() => void onGoogle()}
          className="sc-btn-secondary sc-focus-ring mt-8 w-full disabled:opacity-40"
        >
          {busyGoogle ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
          <div>
            <label className="sc-label">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="sc-input mt-2"
            />
          </div>
          <div>
            <label className="sc-label">Password</label>
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              inputClassName="sc-input mt-2 pr-12"
            />
          </div>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--sc-text-secondary)' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded accent-accent"
              style={{ borderColor: 'var(--sc-border)' }}
            />
            <span>Remember me on this device (auto sign-out after 24 hours)</span>
          </label>
          <button
            type="submit"
            disabled={busyEmail}
            className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
          >
            {busyEmail ? 'Signing in…' : 'Sign in with email'}
          </button>
        </form>

        <div
          className="mt-6 flex flex-wrap justify-between gap-3 text-xs"
          style={{ color: 'var(--sc-accent)' }}
        >
          <Link href="/register" className="hover:underline">
            Need an account?
          </Link>
          <Link href="/forgot-password" className="hover:underline">
            Forgot password
          </Link>
        </div>
      </div>
    </div>
  );
}

function normalizeNextPath(next: string | null): string {
  const fallback = '/app/dashboard';
  if (!next || !next.startsWith('/')) return fallback;
  if (next === '/login' || next.startsWith('/login?')) return fallback;
  if (next === '/register' || next.startsWith('/register?')) return fallback;
  if (next === '/forgot-password' || next.startsWith('/forgot-password?')) return fallback;
  if (!next.startsWith('/app')) return fallback;
  return next;
}
