'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import PasswordField from '@/components/forms/PasswordField';
import { authErrorMessage } from '@/lib/auth-error-message';
import { authRateLimitMessage, consumeAuthAttempt } from '@/lib/client-auth-rate-limit';
import {
  completeGoogleRedirectSignIn,
  registerEmail,
  signInGoogleWeb,
  useWebAuth,
} from '@/lib/firebase-client';

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_DEV = process.env.NODE_ENV !== 'production';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted">Loading signup...</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = React.useMemo(() => normalizeNextPath(sp.get('next')), [sp]);
  const { ready, authLoading, user, syncSessionCookie } = useWebAuth();
  const redirectingRef = React.useRef(false);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busyGoogle, setBusyGoogle] = React.useState(false);
  const [busyEmail, setBusyEmail] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const signedIn = await completeGoogleRedirectSignIn();
        if (cancelled || !signedIn) return;
        if (IS_DEV) console.info('Firebase Google redirect registration succeeded');
        await syncSessionCookie();
        if (IS_DEV) console.info('/api/session sync completed after Google redirect registration');
        router.replace(next);
      } catch (e) {
        if (!cancelled) {
          if (IS_DEV) console.warn('/api/session sync failed after Google redirect registration', e);
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

  async function onGoogle() {
    setBusyGoogle(true);
    setErr(null);
    try {
      const rate = consumeAuthAttempt('register');
      if (!rate.allowed) {
        setErr(authRateLimitMessage(rate.retryAfterMs));
        return;
      }
      const result = await signInGoogleWeb();
      if (result.mode === 'redirect-started') return;
      if (IS_DEV) console.info('Firebase Google popup registration succeeded', { uid: result.user.uid });
      await syncSessionCookie(result.user);
      if (IS_DEV) console.info('/api/session sync completed after Google popup registration');
      router.replace(next);
    } catch (e) {
      if (IS_DEV) console.warn('/api/session sync failed after Google popup registration', e);
      setErr(authErrorMessage(e, 'google'));
    } finally {
      setBusyGoogle(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !SIMPLE_EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > 254) {
      setErr('Enter a valid email address.');
      return;
    }
    if (name.trim().length > 80) {
      setErr('Preferred name must be 80 characters or less.');
      return;
    }
    if (password !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    const rate = consumeAuthAttempt('register');
    if (!rate.allowed) {
      setErr(authRateLimitMessage(rate.retryAfterMs));
      return;
    }
    setBusyEmail(true);
    try {
      const createdUser = await registerEmail(
        trimmedEmail,
        password,
        name.trim() || (trimmedEmail.split('@')[0] ?? 'Planner'),
      );
      if (IS_DEV) console.info('Firebase email registration succeeded', { uid: createdUser.uid });
      await syncSessionCookie(createdUser);
      if (IS_DEV) console.info('/api/session sync completed after email registration');
      router.replace(next);
    } catch (ex) {
      if (IS_DEV) console.warn('Registration or /api/session sync failed after email registration', ex);
      setErr(authErrorMessage(ex, 'register'));
    } finally {
      setBusyEmail(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100vh] w-full max-w-[460px] flex-col justify-center px-6 py-16">
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
          Your planner stays secure and synced across mobile and web.
        </p>
        {err ? (
          <p
            className="mt-6 px-3 py-2 text-xs"
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
          <input
            placeholder="Preferred name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sc-input"
          />
          <input
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="sc-input"
          />
          <PasswordField
            placeholder="password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            inputClassName="sc-input pr-12"
          />
          <PasswordField
            placeholder="confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            inputClassName="sc-input pr-12"
          />
          <button
            disabled={busyEmail}
            type="submit"
            className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
          >
            {busyEmail ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-8 text-xs" style={{ color: 'var(--sc-accent)' }}>
          Already synced?{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'var(--sc-accent-hover)' }}>
            Sign in
          </Link>
        </p>
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
