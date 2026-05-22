'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import { registerEmail, signInGooglePopup, useWebAuth } from '@/lib/firebase-client';

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
  const next = sp.get('next') || '/app';
  const { ready, user, syncSessionCookie } = useWebAuth();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (ready && user) {
      router.replace(next.startsWith('/') ? next : '/app');
    }
  }, [ready, user, next, router]);

  async function onGoogle() {
    setBusy(true);
    setErr(null);
    try {
      await signInGooglePopup();
      await syncSessionCookie();
      router.replace(next.startsWith('/') ? next : '/app');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Google failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await registerEmail(email.trim(), password, name.trim() || (email.split('@')[0] ?? 'Planner'));
      await syncSessionCookie();
      router.replace(next.startsWith('/') ? next : '/app');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Signup failed.');
    } finally {
      setBusy(false);
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
          disabled={busy}
          onClick={() => void onGoogle()}
          className="sc-btn-secondary sc-focus-ring mt-8 w-full disabled:opacity-40"
        >
          Continue with Google
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
            disabled={busy}
            type="submit"
            className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
          >
            Create account
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
