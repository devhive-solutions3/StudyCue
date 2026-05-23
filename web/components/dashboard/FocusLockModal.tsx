'use client';

import { useDashboardUi } from '@/context/dashboard-ui';

export default function FocusLockModal() {
  const { focusLockModalOpen, closeFocusLockModal } = useDashboardUi();

  if (!focusLockModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="Focus session active"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={closeFocusLockModal} />
      <div className="relative w-full max-w-[420px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-text-primary">Focus session active</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              Please stay in your focus session for now, or go back to Focus Timer and end the session first.
            </p>
          </div>
          <button type="button" onClick={closeFocusLockModal} className="rounded-full bg-surface-2 px-3 py-2 text-text-secondary">
            ×
          </button>
        </div>
        <button type="button" onClick={closeFocusLockModal} className="sc-btn-primary min-h-[52px] w-full rounded-full">
          Back to session
        </button>
      </div>
    </div>
  );
}
