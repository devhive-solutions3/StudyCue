'use client';

import Link from 'next/link';
import * as React from 'react';

import { sendPasswordReset } from '@/lib/firebase-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await sendPasswordReset(email.trim());
      setMsg(`If ${email.trim()} matches an email/password login, recovery mail was sent.`);
    } catch {
      setMsg('Could not start reset — validate email casing.');
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
          OAuth-only profiles should use provider recovery flows.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
          <input
            placeholder="school email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="sc-input"
          />
          <button
            disabled={busy}
            className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
          >
            Send reset mail
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
