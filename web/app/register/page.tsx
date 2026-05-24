'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { authErrorMessage } from '@/lib/auth-error-message';
import {
  completeGoogleRedirectSignIn,
  registerEmail,
  signInGoogleWeb,
  useWebAuth,
} from '@/lib/firebase-client';

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        await syncSessionCookie();
        router.replace(next);
      } catch (e) {
        if (!cancelled) setErr(authErrorMessage(e, 'google'));
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
        await syncSessionCookie();
        router.replace(next);
      } catch {
        redirectingRef.current = false;
        setErr('Could not start your secure session. Please try again.');
      }
    })();
  }, [ready, authLoading, user, next, router, syncSessionCookie]);

  async function onGoogle() {
    setBusyGoogle(true);
    setErr(null);
    try {
      const mode = await signInGoogleWeb();
      if (mode === 'redirect-started') return;
      await syncSessionCookie();
      router.replace(next);
    } catch (e) {
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
    setBusyEmail(true);
    try {
      await registerEmail(trimmedEmail, password, name.trim() || (trimmedEmail.split('@')[0] ?? 'Planner'));
      await syncSessionCookie();
      router.replace(next);
    } catch (ex) {
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
          <input
            placeholder="password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            minLength={6}
            className="sc-input"
          />
          <input
            placeholder="confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            minLength={6}
            className="sc-input"
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
