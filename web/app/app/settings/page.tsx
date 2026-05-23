'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { useMirror } from '@/context/mirror-context';
import { type AppTheme, useTheme } from '@/context/theme-context';
import {
  changePassword,
  deleteGoogleAccount,
  scheduleAccountDeletion,
  uploadProfilePic,
  useWebAuth,
} from '@/lib/firebase-client';
import { getLocalProfilePhoto } from '@/lib/local-file-store';
import { emptyMirror } from '@/lib/mirror-bootstrap';
import { PROFILE_LIMIT_HINT } from '@/lib/upload-limits';

type Msg = { text: string; ok: boolean };

const THEMES: { value: AppTheme; label: string; emoji: string }[] = [
  { value: 'light', label: 'Light', emoji: '☀️' },
  { value: 'dark', label: 'Dark', emoji: '🌙' },
  { value: 'system', label: 'System', emoji: '💻' },
];

export default function SettingsRoutePage() {
  const { logout, user } = useWebAuth();
  const { commitMirror } = useMirror();
  const { theme, setTheme } = useTheme();

  // ── Pending form state ─────────────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpNew2, setCpNew2] = useState('');

  // ── State ──────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletionScheduled, setDeletionScheduled] = useState(false);

  const ids = user?.providerIds ?? [];
  const googleLinked = ids.includes('google.com');
  const emailLinked = ids.includes('password');
  const visibleAvatar = avatarPreview ?? getLocalProfilePhoto(user?.uid) ?? user?.photoURL ?? null;

  const hasUnsavedChanges =
    pendingAvatarFile != null ||
    cpCurrent.trim() !== '' ||
    cpNew.trim() !== '' ||
    cpNew2.trim() !== '';

  function flash(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 6000);
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.currentTarget.value = '';
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const errors: string[] = [];

    // 1. Profile pic upload
    if (pendingAvatarFile) {
      try {
        const photoUrl = await uploadProfilePic(pendingAvatarFile);
        setAvatarPreview(photoUrl);
        setPendingAvatarFile(null);
      } catch (e) {
        errors.push(`Profile pic: ${e instanceof Error ? e.message : 'upload failed'}`);
      }
    }

    // 2. Password change (only if fields are filled)
    const wantsPasswordChange = cpCurrent.trim() || cpNew.trim() || cpNew2.trim();
    if (wantsPasswordChange) {
      if (!emailLinked) {
        errors.push('Password change is only available for email/password accounts.');
      } else if (cpNew !== cpNew2) {
        errors.push('New passwords do not match.');
      } else if (cpNew.length < 8) {
        errors.push('New password must be at least 8 characters.');
      } else {
        try {
          await changePassword(cpCurrent, cpNew);
          setCpCurrent('');
          setCpNew('');
          setCpNew2('');
        } catch (e) {
          errors.push(`Password: ${e instanceof Error ? e.message : 'change failed'}`);
        }
      }
    }

    setBusy(false);

    if (errors.length > 0) {
      flash(errors.join(' · '), false);
    } else {
      flash('Changes saved!');
    }
  }

  async function handleScheduleDeletion() {
    if (emailLinked && !deletePassword.trim()) {
      flash('Enter your current password to confirm.', false);
      return;
    }
    setBusy(true);
    try {
      await scheduleAccountDeletion(emailLinked ? deletePassword : undefined);
      setDeletionScheduled(true);
      window.location.href = '/login?deleted=scheduled';
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not schedule deletion.', false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGoogle() {
    setBusy(true);
    try {
      await deleteGoogleAccount();
      window.location.href = '/';
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Google deletion cancelled.', false);
    } finally {
      setBusy(false);
    }
  }

  function handleResetSettings() {
    const ok = window.confirm(
      'This will restore preferences (focus duration, break length, etc.) to their defaults. Your tasks, notes, and history are not affected.',
    );
    if (!ok) return;
    commitMirror((prev) => ({ ...prev, preferences: emptyMirror().preferences }));
    flash('Settings reset to defaults.');
  }

  const initials = (user?.displayName ?? user?.email ?? 'SC')
    .split(/\s+/)
    .map((x: string) => x[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SC';

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-6 pb-10 md:max-w-2xl">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your account, appearance, and privacy controls.
        </p>
      </div>

      {/* Global message */}
      {msg && (
        <div
          className={[
            'rounded-[12px] px-4 py-3 text-sm',
            msg.ok
              ? 'border border-teal-200 bg-teal-50 text-teal-700'
              : 'border border-rose-200 bg-rose-50 text-rose-700',
          ].join(' ')}
        >
          {msg.text}
        </div>
      )}

      {/* ── Profile ──────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-[14px] border border-border bg-surface-2 p-5">
        <h2 className="text-base font-semibold text-text-primary">Profile</h2>

        {/* Avatar picker */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-2 ring-border transition hover:ring-accent"
            title="Change profile picture"
          >
            {visibleAvatar ? (
              <Image src={visibleAvatar} alt="Avatar" fill className="object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-lg font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--purple), var(--indigo))' }}
              >
                {initials}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
              <span className="text-xs font-medium text-white">Change</span>
            </div>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarPick}
          />
          <p className="text-xs text-text-muted">{PROFILE_LIMIT_HINT}</p>
          <div className="min-w-0">
            <p className="font-medium text-text-primary">{user?.displayName ?? 'Student'}</p>
            <p className="text-sm text-text-secondary">{user?.email ?? '—'}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-text-muted">
              {ids.length ? ids.join(' · ') : 'unknown provider'}
            </p>
          </div>
        </div>
        {pendingAvatarFile && (
          <p className="text-xs text-accent">New photo selected — click Save changes to apply.</p>
        )}

        <button
          type="button"
          onClick={() =>
            logout()
              .then(() => (window.location.href = '/'))
              .catch(console.warn)
          }
          className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
        >
          Sign out
        </button>
      </section>

      {/* ── Appearance ──────────────────────────────────────────── */}
      <section className="space-y-4 rounded-[14px] border border-border bg-surface-2 p-5">
        <h2 className="text-base font-semibold text-text-primary">Appearance</h2>
        <p className="text-sm text-text-secondary">Choose how StudyCue looks. Takes effect immediately.</p>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={[
                'flex flex-1 flex-col items-center gap-1.5 rounded-[12px] border px-3 py-3 text-sm transition',
                theme === t.value
                  ? 'border-accent bg-accent-light text-accent font-medium'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-2',
              ].join(' ')}
            >
              <span className="text-xl">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Change Password ────────────────────────────────────── */}
      {emailLinked && (
        <section className="space-y-4 rounded-[14px] border border-border bg-surface-2 p-5">
          <h2 className="text-base font-semibold text-text-primary">Change password</h2>
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Current password"
              value={cpCurrent}
              onChange={(e) => setCpCurrent(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={cpNew}
              onChange={(e) => setCpNew(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={cpNew2}
              onChange={(e) => setCpNew2(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
        </section>
      )}

      {/* ── Reset settings ─────────────────────────────────────── */}
      <section className="space-y-3 rounded-[14px] border border-border bg-surface-2 p-5">
        <h2 className="text-base font-semibold text-text-primary">Reset settings</h2>
        <p className="text-sm text-text-secondary">
          Restore preferences (focus duration, break length, energy mode) to defaults. Tasks, notes, and session history are not affected.
        </p>
        <button
          type="button"
          onClick={handleResetSettings}
          className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-surface-2"
        >
          Reset to defaults
        </button>
      </section>

      {/* ── Support ─────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-[14px] border border-border bg-surface-2 p-5">
        <h2 className="text-base font-semibold text-text-primary">Support</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/help" className="inline-flex w-fit rounded-[10px] border border-border bg-surface px-4 py-2 text-sm text-text-primary hover:bg-surface-2">
            Help center
          </Link>
          <Link href="/privacy" className="inline-flex w-fit rounded-[10px] border border-border bg-surface px-4 py-2 text-sm text-text-primary hover:bg-surface-2">
            Privacy policy
          </Link>
        </div>
      </section>

      {/* ── Danger zone ────────────────────────────────────────── */}
      <div className="rounded-[14px] border border-rose-200 bg-rose-50/60">
        <button
          type="button"
          onClick={() => setDangerOpen((p) => !p)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-base font-semibold text-rose-700">Danger zone</span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={['text-rose-500 transition-transform', dangerOpen ? 'rotate-180' : ''].join(' ')}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {dangerOpen && (
          <div className="space-y-4 border-t border-rose-200 px-5 pb-5 pt-4">
            <p className="text-sm text-rose-700">
              Deleting your account schedules permanent removal of all your StudyCue data in{' '}
              <strong>30 days</strong>. Sign back in within that window to cancel.
            </p>

            {emailLinked && (
              <div className="space-y-2 rounded-[12px] border border-rose-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-500">
                  Confirm with your password
                </p>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your current password"
                  className="w-full rounded-[10px] border border-rose-200 bg-white px-3 py-2.5 text-sm text-text-primary outline-none"
                />
                <button
                  type="button"
                  disabled={busy || deletionScheduled}
                  onClick={() => void handleScheduleDeletion()}
                  className="rounded-[10px] bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-40"
                >
                  {deletionScheduled ? 'Deletion scheduled' : 'Delete account'}
                </button>
              </div>
            )}

            {googleLinked && (
              <div className="space-y-2 rounded-[12px] border border-rose-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-500">
                  Google · re-auth required
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDeleteGoogle()}
                  className="rounded-[10px] bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-40"
                >
                  Delete account
                </button>
              </div>
            )}

            {!emailLinked && !googleLinked && (
              <p className="text-xs text-rose-600">
                No recognized providers — reload after logging in to see deletion options.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Save button (sticky at bottom) ─────────────────────── */}
      <div className="sticky bottom-4 z-20">
        <button
          type="button"
          disabled={busy || !hasUnsavedChanges}
          onClick={() => void handleSave()}
          className={[
            'w-full rounded-[14px] py-3.5 text-base font-semibold text-white shadow-[var(--shadow-accent)] transition',
            hasUnsavedChanges && !busy
              ? 'bg-accent hover:bg-accent-hover'
              : 'bg-accent/40 cursor-not-allowed',
          ].join(' ')}
        >
          {busy ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'No unsaved changes'}
        </button>
      </div>
    </div>
  );
}
