'use client';

import Link from 'next/link';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import {
  clearRememberedEmail,
  readRememberMe,
  readRememberedEmail,
  setAuthPersistence,
  signInEmail,
  signInGooglePopup,
  useWebAuth,
  writeRememberMe,
  writeRememberedEmail,
} from '@/lib/firebase-client';

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
  const next = sp.get('next') || '/app';
  const { ready, user, syncSessionCookie } = useWebAuth();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const remembered = readRememberMe();
    setRememberMe(remembered);
    if (remembered) {
      const savedEmail = readRememberedEmail();
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  React.useEffect(() => {
    if (ready && user) {
      router.replace(next.startsWith('/') ? next : '/app');
    }
  }, [ready, user, next, router]);

  function persistRememberMe(value: boolean, emailValue: string) {
    writeRememberMe(value);
    if (value) {
      writeRememberedEmail(emailValue);
    } else {
      clearRememberedEmail();
    }
  }

  async function onGoogle() {
    setBusy(true);
    setErr(null);
    try {
      persistRememberMe(rememberMe, email.trim());
      await setAuthPersistence(rememberMe);
      await signInGooglePopup();
      await syncSessionCookie();
      router.replace(next.startsWith('/') ? next : `/app`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Google login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const trimmed = email.trim();
      persistRememberMe(rememberMe, trimmed);
      await setAuthPersistence(rememberMe);
      await signInEmail(trimmed, password);
      await syncSessionCookie();
      router.replace(next.startsWith('/') ? next : `/app`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Email/password failed.');
    } finally {
      setBusy(false);
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
          disabled={busy}
          onClick={() => void onGoogle()}
          className="sc-btn-secondary sc-focus-ring mt-8 w-full disabled:opacity-40"
        >
          Continue with Google
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
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="sc-input mt-2"
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
            disabled={busy}
            className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
          >
            Sign in with email
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
