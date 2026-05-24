'use client';

import Link from 'next/link';
import * as React from 'react';

import { authErrorMessage, getAuthErrorCode } from '@/lib/auth-error-message';
import { lookupSignInMethods, sendPasswordReset } from '@/lib/firebase-client';

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_COOLDOWN_MS = 60_000;
const IS_DEV = process.env.NODE_ENV !== 'production';

function cooldownKey(email: string) {
  return `studycue-reset-cooldown:${email.toLowerCase()}`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const normalizedEmail = email.trim().toLowerCase();
  const cooldownUntil = React.useMemo(() => {
    if (!normalizedEmail || typeof window === 'undefined') return 0;
    const raw = window.sessionStorage.getItem(cooldownKey(normalizedEmail));
    const expiresAt = Number(raw);
    return Number.isFinite(expiresAt) ? expiresAt : 0;
  }, [normalizedEmail]);
  const cooldownLeftMs = Math.max(0, cooldownUntil - now);

  React.useEffect(() => {
    if (cooldownLeftMs <= 0) return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldownLeftMs]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !SIMPLE_EMAIL_RE.test(trimmed) || trimmed.length > 254) {
      setMsg('Enter a valid email address.');
      return;
    }
    if (cooldownLeftMs > 0) {
      setMsg(`Please wait ${Math.ceil(cooldownLeftMs / 1000)} seconds before trying again.`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const methods = await lookupSignInMethods(trimmed);
      const hasPassword = methods.includes('password');
      const hasGoogle = methods.includes('google.com');

      if (hasGoogle && !hasPassword) {
        setMsg('This account uses Google sign-in. Please continue with Google, or sign in and add a password from Settings.');
        return;
      }

      if (hasPassword) {
        await sendPasswordReset(trimmed);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(cooldownKey(trimmed), String(Date.now() + RESET_COOLDOWN_MS));
        }
        setNow(Date.now());
        setMsg(
          'If this email has a password login, a reset email has been sent. Please check your inbox and spam folder.',
        );
        return;
      }

      if (IS_DEV) console.warn('No password provider found for reset email lookup', { email: trimmed, methods });
      await sendPasswordReset(trimmed);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(cooldownKey(trimmed), String(Date.now() + RESET_COOLDOWN_MS));
      }
      setNow(Date.now());
      setMsg(
        'If this email is connected to a password login, a reset email has been sent. Please check your inbox and spam folder.',
      );
    } catch (e) {
      const code = getAuthErrorCode(e);
      if (IS_DEV) console.warn('Password reset request failed', code ?? e);

      if (code === 'auth/user-not-found') {
        setMsg(
          'If this email is connected to a password login, a reset email has been sent. Please check your inbox and spam folder.',
        );
      } else {
        setMsg(authErrorMessage(e, 'reset'));
      }
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
          Enter the email connected to your StudyCue account.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
          <label className="sc-label">
            Email
          </label>
          <input
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="sc-input"
          />
          <button
            disabled={busy || cooldownLeftMs > 0}
            className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
          >
            {busy ? 'Sending…' : cooldownLeftMs > 0 ? `Resend in ${Math.ceil(cooldownLeftMs / 1000)}s` : 'Send reset mail'}
          </button>
        </form>
        {msg ? (
          <p
            className="mt-4 px-4 py-3 text-xs"
            style={{
              background: 'var(--sc-surface-soft)',
              color: 'var(--sc-text-secondary)',
              border: '1px solid var(--sc-border)',
              borderRadius: 'var(--sc-radius-sm)',
            }}
          >
            {msg}
          </p>
        ) : null}
        <Link
          href="/login"
          className="mt-6 inline-block text-xs hover:underline"
          style={{ color: 'var(--sc-accent)' }}
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
