'use client';

import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'studycue.cloudBannerDismissed';

export default function CloudBackupBanner({ onBackupNow }: { onBackupNow: () => void }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const v = localStorage.getItem(DISMISSED_KEY);
    setHidden(v === '1');
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[16px] border border-border bg-surface px-5 py-4 shadow-[var(--shadow-sm)]">
      <div className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-blue-50 text-[11px] font-semibold text-blue-600">
        CL
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">Web and cloud backup</p>
        <p className="text-[12.5px] text-text-muted">
          Back up study data so the StudyCue web app can load from the same Google account.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBackupNow}
          className="rounded-[8px] bg-accent px-4 py-2 text-xs font-medium text-white shadow-[var(--shadow-accent)] hover:bg-accent-hover"
        >
          Backup now
        </button>
        <button type="button" className="rounded-[8px] border border-border px-4 py-2 text-xs text-text-secondary hover:bg-surface-2">
          Restore
        </button>
        <button type="button" onClick={dismiss} className="rounded-[8px] px-3 py-2 text-xs text-text-muted hover:text-text-secondary">
          Close
        </button>
      </div>
    </section>
  );
}
