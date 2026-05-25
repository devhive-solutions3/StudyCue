'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function AdminBetaSignupToggle({
  initialEnabled,
  source,
}: {
  initialEnabled: boolean;
  source?: 'firestore' | 'env' | 'default';
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateMode(nextEnabled: boolean) {
    setPendingState(nextEnabled);
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings/beta-signups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      setFeedback(`Beta signup mode is now ${nextEnabled ? 'ON' : 'OFF'}.`);
      setError(null);
      startTransition(() => router.refresh());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update beta signup mode.');
      setFeedback(null);
      setEnabled(!nextEnabled);
    } finally {
      setSaving(false);
    }
  }

  function setPendingState(nextEnabled: boolean) {
    setEnabled(nextEnabled);
    setFeedback(null);
    setError(null);
  }

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_16px_48px_rgba(9,12,35,0.18)] backdrop-blur-xl dark:border-white/8 dark:bg-white/6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-text-muted">
            Beta signup mode
          </p>
          <p className="mt-3 text-2xl font-black tracking-tight text-text-primary">
            {enabled ? 'On' : 'Off'}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            When enabled, new users are created as Beta. When disabled, new users are created as Free.
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            New accounts are currently created as {enabled ? 'Beta' : 'Free'} users.
          </p>
          {process.env.NODE_ENV !== 'production' && source ? (
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-text-muted">
              Source: {source}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving || pending}
          onClick={() => void updateMode(!enabled)}
          className={[
            'relative inline-flex h-8 w-14 shrink-0 rounded-full border transition',
            enabled
              ? 'border-accent/35 bg-accent/20'
              : 'border-white/10 bg-black/10',
            saving || pending ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
              enabled ? 'left-7' : 'left-1',
            ].join(' ')}
          />
        </button>
      </div>
      {feedback ? <p className="mt-3 text-sm text-emerald-200">{feedback}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
    </article>
  );
}
