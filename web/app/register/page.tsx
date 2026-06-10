'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';

import PasswordField from '@/components/forms/PasswordField';
import TermsPrivacyAgreementModal from '@/components/legal/TermsPrivacyAgreementModal';
import { authErrorMessage } from '@/lib/auth-error-message';
import { authRateLimitMessage, consumeAuthAttempt } from '@/lib/client-auth-rate-limit';
import {
  acceptCurrentLegalTerms,
  completeGoogleRedirectSignIn,
  registerEmail,
  signInGoogleWeb,
  useWebAuth,
} from '@/lib/firebase-client';
import { buildLegalAcceptancePayload, type LegalAcceptancePayload } from '@/lib/legal-consent';

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IS_DEV = process.env.NODE_ENV !== 'production';
const PENDING_LEGAL_ACCEPTANCE_KEY = 'studycue.pendingLegalAcceptance';

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
  const [busyLegal, setBusyLegal] = React.useState(false);
  const [legalAccepted, setLegalAccepted] = React.useState(false);
  const [legalModalOpen, setLegalModalOpen] = React.useState(false);
  const [legalErr, setLegalErr] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const signedIn = await completeGoogleRedirectSignIn();
        if (cancelled || !signedIn) return;
        if (IS_DEV) console.info('Firebase Google redirect registration succeeded');
        const pendingAcceptance = readPendingLegalAcceptance();
        if (!pendingAcceptance) {
          setLegalErr('Please read and accept the Terms of Use and Privacy Policy to continue.');
          setLegalModalOpen(true);
          return;
        }
        await acceptCurrentLegalTerms(pendingAcceptance);
        clearPendingLegalAcceptance();
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
        const pendingAcceptance = readPendingLegalAcceptance();
        if (pendingAcceptance) {
          await acceptCurrentLegalTerms(pendingAcceptance);
          clearPendingLegalAcceptance();
        } else if (!legalAccepted) {
          redirectingRef.current = false;
          setLegalErr('Please read and accept the Terms of Use and Privacy Policy to continue.');
          setLegalModalOpen(true);
          return;
        }
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
  }, [ready, authLoading, user, legalAccepted, next, router, syncSessionCookie]);

  async function onGoogle() {
    if (!legalAccepted) {
      setLegalErr('Please read and accept the Terms of Use and Privacy Policy to continue.');
      return;
    }
    setBusyGoogle(true);
    setErr(null);
    setLegalErr(null);
    try {
      const rate = consumeAuthAttempt('register');
      if (!rate.allowed) {
        setErr(authRateLimitMessage(rate.retryAfterMs));
        return;
      }
      const acceptance = buildLegalAcceptancePayload();
      writePendingLegalAcceptance(acceptance);
      const result = await signInGoogleWeb();
      if (result.mode === 'redirect-started') return;
      if (IS_DEV) console.info('Firebase Google popup registration succeeded', { uid: result.user.uid });
      await acceptCurrentLegalTerms(acceptance);
      clearPendingLegalAcceptance();
      await syncSessionCookie(result.user);
      if (IS_DEV) console.info('/api/session sync completed after Google popup registration');
      router.replace(next);
    } catch (e) {
      clearPendingLegalAcceptance();
      if (IS_DEV) console.warn('/api/session sync failed after Google popup registration', e);
      setErr(authErrorMessage(e, 'google'));
    } finally {
      setBusyGoogle(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLegalErr(null);
    if (!legalAccepted) {
      setLegalErr('Please read and accept the Terms of Use and Privacy Policy to continue.');
      return;
    }
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
        buildLegalAcceptancePayload(),
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
        {legalErr ? (
          <p
            className="mt-4 px-3 py-2 text-xs"
            style={{
              background: 'var(--sc-danger-soft)',
              color: 'var(--sc-danger)',
              border: '1px solid var(--sc-border)',
              borderRadius: 'var(--sc-radius-sm)',
            }}
          >
            {legalErr}
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
          <div className="rounded-[16px] border border-border bg-surface-2 px-3 py-3">
            <label className="flex items-start gap-3 text-xs leading-6 text-text-secondary">
              <input
                type="checkbox"
                className="mt-1"
                checked={legalAccepted}
                readOnly
                required
                onClick={(event) => {
                  event.preventDefault();
                  if (!legalAccepted) {
                    setLegalModalOpen(true);
                    setLegalErr(null);
                  }
                }}
              />
              <span>
                I have read and agree to the{' '}
                <Link href="/terms" className="font-semibold text-accent underline underline-offset-4">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="font-semibold text-accent underline underline-offset-4">
                  Privacy Policy
                </Link>
                .{' '}
                <Link href="/cookies" className="font-semibold text-accent underline underline-offset-4">
                  Cookies Policy
                </Link>
                , including the advertising disclosure for the Free plan.
              </span>
            </label>
            <button
              type="button"
              onClick={() => setLegalModalOpen(true)}
              className="sc-focus-ring mt-3 rounded-[12px] border border-border px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface"
            >
              Read Terms and Privacy
            </button>
          </div>
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
      <TermsPrivacyAgreementModal
        open={legalModalOpen}
        busy={busyLegal}
        onClose={() => setLegalModalOpen(false)}
        onAgree={async () => {
          setBusyLegal(true);
          try {
            if (user) {
              await acceptCurrentLegalTerms(buildLegalAcceptancePayload());
            }
            setLegalAccepted(true);
            setLegalErr(null);
            setLegalModalOpen(false);
          } catch (error) {
            setLegalErr(
              error instanceof Error ? error.message : 'Could not save your acceptance. Please try again.',
            );
          } finally {
            setBusyLegal(false);
          }
        }}
      />
    </div>
  );
}

function writePendingLegalAcceptance(acceptance: LegalAcceptancePayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_LEGAL_ACCEPTANCE_KEY, JSON.stringify(acceptance));
}

function readPendingLegalAcceptance(): LegalAcceptancePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_LEGAL_ACCEPTANCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegalAcceptancePayload;
    if (
      parsed.termsAccepted === true &&
      parsed.privacyAccepted === true &&
      parsed.adsDisclosureAccepted === true
    ) {
      return parsed;
    }
  } catch {
    /* noop */
  }
  return null;
}

function clearPendingLegalAcceptance() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_LEGAL_ACCEPTANCE_KEY);
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
