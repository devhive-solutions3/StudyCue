'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';
import { useFocusTimer } from '@/context/focus-timer';
import { useMirror } from '@/context/mirror-context';

function isTaskDone(status: string | null | undefined) {
  return ['done', 'completed'].includes((status ?? '').toLowerCase());
}

/** Syncs sidebar guard with active focus timer. */
export function FocusTimerUiBridge() {
  const { running, paused } = useFocusTimer();
  const { setFocusLocked } = useDashboardUi();

  useEffect(() => {
    setFocusLocked(running || paused);
  }, [paused, running, setFocusLocked]);

  return null;
}

function FocusNavigationGuardModal() {
  const router = useRouter();
  const { focusLockModalOpen, closeFocusLockModal, pendingNavHref, setPendingNavHref } =
    useDashboardUi();
  const { stopTimer } = useFocusTimer();

  if (!focusLockModalOpen) return null;

  function closeGuard() {
    closeFocusLockModal();
    setPendingNavHref(null);
  }

  function stayFocused() {
    closeGuard();
  }

  function endSession() {
    const href = pendingNavHref;
    stopTimer();
    closeFocusLockModal();
    setPendingNavHref(null);
    if (href) router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="focus-guard-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          stayFocused();
        }
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Stay focused"
        onClick={stayFocused}
      />
      <div className="relative w-full max-w-[420px] rounded-[30px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-md)]">
        <h2 id="focus-guard-title" className="text-2xl font-extrabold text-text-primary">
          Focus on your study
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          You have an active focus session. Stay focused or end the session before leaving.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={stayFocused}
            className="min-h-[48px] w-full rounded-full bg-accent px-4 py-2.5 text-sm font-extrabold text-white hover:bg-accent-hover"
          >
            Stay focused
          </button>
          <button
            type="button"
            onClick={endSession}
            className="min-h-[48px] w-full rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-extrabold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200"
          >
            End session
          </button>
        </div>
      </div>
    </div>
  );
}

function FocusSessionCompleteModal() {
  const { mirror } = useMirror();
  const { completionModal, dismissCompletionModal } = useFocusTimer();

  if (!completionModal?.open) return null;

  const task =
    completionModal.connectedTaskId != null
      ? mirror.tasks.find((row) => row.id === completionModal.connectedTaskId)
      : null;

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="focus-complete-title"
    >
      <div className="w-full max-w-[400px] rounded-[24px] border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Session complete</p>
        <h2 id="focus-complete-title" className="mt-2 text-xl font-semibold text-text-primary">
          Focus session complete
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Nice work. Your focus session has been completed.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">Duration:</span>{' '}
            {completionModal.durationMinutes} min
          </li>
          <li>
            <span className="font-semibold text-text-primary">Session:</span>{' '}
            {completionModal.sessionTitle.trim() || 'Focus session'}
          </li>
          {task ? (
            <li>
              <span className="font-semibold text-text-primary">Linked task:</span> {task.title?.trim()}
            </li>
          ) : null}
        </ul>
        <button
          type="button"
          onClick={dismissCompletionModal}
          className="mt-5 w-full rounded-full bg-accent px-4 py-2.5 text-sm font-extrabold text-white hover:bg-accent-hover"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function FocusTaskCompletePrompt() {
  const { completePromptTaskId, dismissCompletionPrompt, markPromptTaskDone } = useFocusTimer();
  const { mirror } = useMirror();

  if (completePromptTaskId == null) return null;

  const task = mirror.tasks.find((row) => row.id === completePromptTaskId);
  if (!task || isTaskDone(task.status)) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="focus-task-prompt-title"
    >
      <div className="w-full max-w-[380px] rounded-[24px] border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Session complete</p>
        <h2 id="focus-task-prompt-title" className="mt-2 text-xl font-semibold text-text-primary">
          Mark task as done?
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          You finished a focus session linked to this task. Do you want to mark it as done?
        </p>
        <p className="mt-2 text-sm font-semibold text-text-primary">
          Task: {task.title?.trim() || `Task ${completePromptTaskId}`}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={markPromptTaskDone}
            className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-extrabold text-white hover:bg-accent-hover"
          >
            Yes, mark as done
          </button>
          <button
            type="button"
            onClick={dismissCompletionPrompt}
            className="flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm font-extrabold text-text-primary hover:bg-surface"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FocusTimerModals() {
  return (
    <>
      <FocusNavigationGuardModal />
      <FocusSessionCompleteModal />
      <FocusTaskCompletePrompt />
    </>
  );
}
