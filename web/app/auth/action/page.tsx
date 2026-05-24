'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';

import PasswordField from '@/components/forms/PasswordField';
import { getAuthErrorCode } from '@/lib/auth-error-message';
import { getFirebaseAuth } from '@/lib/firebase-client';

const IS_DEV = process.env.NODE_ENV !== 'production';
const MIN_PASSWORD_LEN = 8;

type View =
  | 'loading'
  | 'unsupported'
  | 'missing-code'
  | 'form'
  | 'expired'
  | 'success';

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <p className="text-center text-sm" style={{ color: 'var(--sc-text-secondary)' }}>
            Loading…
          </p>
        </AuthShell>
      }
    >
      <AuthActionContent />
    </Suspense>
  );
}

function AuthActionContent() {
  const sp = useSearchParams();
  const mode = sp.get('mode');
  const oobCode = sp.get('oobCode');

  const [view, setView] = React.useState<View>(() => {
    if (mode !== 'resetPassword') return 'unsupported';
    if (!oobCode) return 'missing-code';
    return 'loading';
  });
  const [verifiedEmail, setVerifiedEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'resetPassword' || !oobCode) return;

    let cancelled = false;
    void (async () => {
      try {
        const auth = getFirebaseAuth();
        const email = await verifyPasswordResetCode(auth, oobCode);
        if (cancelled) return;
        setVerifiedEmail(email);
        setView('form');
      } catch (e) {
        if (cancelled) return;
        const code = getAuthErrorCode(e);
        if (IS_DEV) console.warn('Password reset code verification failed', code ?? e);
        setView('expired');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!password) {
      setFormError('Enter a new password.');
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (!oobCode) {
      setView('missing-code');
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      await confirmPasswordReset(auth, oobCode, password);
      setView('success');
    } catch (e) {
      const code = getAuthErrorCode(e);
      if (IS_DEV) console.warn('Password reset confirmation failed', code ?? e);
      setView('expired');
    } finally {
      setBusy(false);
    }
  }

  if (view === 'unsupported') {
    return (
      <AuthShell>
        <AuthHeading>Unsupported account action</AuthHeading>
        <AuthMessage>This account action is not supported.</AuthMessage>
        <AuthPrimaryLink href="/login">Back to login</AuthPrimaryLink>
      </AuthShell>
    );
  }

  if (view === 'missing-code') {
    return (
      <AuthShell>
        <AuthHeading>Invalid reset link</AuthHeading>
        <AuthMessage>
          This reset link is missing or invalid. Please request a new password reset link.
        </AuthMessage>
        <div className="mt-6 flex flex-col gap-3">
          <AuthPrimaryLink href="/forgot-password">Request new reset link</AuthPrimaryLink>
          <AuthSecondaryLink href="/login">Back to login</AuthSecondaryLink>
        </div>
      </AuthShell>
    );
  }

  if (view === 'loading') {
    return (
      <AuthShell>
        <AuthHeading>Reset password</AuthHeading>
        <AuthMessage>Verifying your reset link…</AuthMessage>
      </AuthShell>
    );
  }

  if (view === 'expired') {
    return (
      <AuthShell>
        <AuthHeading>Reset link expired</AuthHeading>
        <AuthMessage>
          This reset link is expired, invalid, or already used. Please request a new password reset
          link.
        </AuthMessage>
        <div className="mt-6 flex flex-col gap-3">
          <AuthPrimaryLink href="/forgot-password">Request new reset link</AuthPrimaryLink>
          <AuthSecondaryLink href="/login">Back to login</AuthSecondaryLink>
        </div>
      </AuthShell>
    );
  }

  if (view === 'success') {
    return (
      <AuthShell>
        <AuthHeading>Password updated</AuthHeading>
        <AuthMessage>
          Your StudyCue password has been reset. You can now sign in with your new password.
        </AuthMessage>
        <AuthPrimaryLink href="/login">Back to login</AuthPrimaryLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading>Reset password</AuthHeading>
      <AuthMessage>
        Choose a new password for{' '}
        <span className="font-medium" style={{ color: 'var(--sc-text-primary)' }}>
          {verifiedEmail}
        </span>
        .
      </AuthMessage>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
        <div>
          <label className="sc-label">New password</label>
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            inputClassName="sc-input mt-2 pr-12"
          />
        </div>
        <div>
          <label className="sc-label">Confirm password</label>
          <PasswordField
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            inputClassName="sc-input mt-2 pr-12"
          />
        </div>
        {formError ? (
          <p
            className="px-3 py-3 text-xs"
            style={{
              background: 'var(--sc-danger-soft)',
              color: 'var(--sc-danger)',
              border: '1px solid var(--sc-border)',
              borderRadius: 'var(--sc-radius-sm)',
            }}
          >
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="sc-btn-primary sc-focus-ring w-full disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
      <AuthSecondaryLink href="/login" className="mt-6">
        Back to login
      </AuthSecondaryLink>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
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
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function AuthHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center text-lg font-semibold" style={{ color: 'var(--sc-text-primary)' }}>
      {children}
    </h2>
  );
}

function AuthMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-center text-sm" style={{ color: 'var(--sc-text-secondary)' }}>
      {children}
    </p>
  );
}

function AuthPrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="sc-btn-primary sc-focus-ring inline-block w-full text-center no-underline"
    >
      {children}
    </Link>
  );
}

function AuthSecondaryLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-block w-full text-center text-xs hover:underline ${className}`.trim()}
      style={{ color: 'var(--sc-accent)' }}
    >
      {children}
    </Link>
  );
}
