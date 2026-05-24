'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';

const STORAGE_KEY = 'studycue_focus_timer_state';

type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'completed';

type PersistedTimerState = {
  startedAt: number | null;
  durationSeconds: number;
  remainingSeconds: number;
  status: FocusTimerStatus;
  sessionTitle: string;
  connectedTaskId: number | null;
  pausedAt: number | null;
  endsAt: number | null;
  completePromptTaskId: number | null;
};

type FocusTimerContextValue = {
  hydrated: boolean;
  status: FocusTimerStatus;
  running: boolean;
  paused: boolean;
  durationSeconds: number;
  remainingSeconds: number;
  sessionTitle: string;
  connectedTaskId: number | null;
  completePromptTaskId: number | null;
  startTimer: (params: {
    durationSeconds: number;
    sessionTitle: string;
    connectedTaskId: number | null;
  }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  togglePause: () => void;
  addTime: (minutes: number) => void;
  stopTimer: () => void;
  dismissCompletionPrompt: () => void;
  markPromptTaskDone: () => void;
};

const FocusTimerCtx = createContext<FocusTimerContextValue | null>(null);

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function readStoredState(): PersistedTimerState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTimerState;
  } catch {
    return null;
  }
}

function writeStoredState(state: PersistedTimerState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearStoredState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function defaultState(): PersistedTimerState {
  return {
    startedAt: null,
    durationSeconds: 0,
    remainingSeconds: 0,
    status: 'idle',
    sessionTitle: '',
    connectedTaskId: null,
    pausedAt: null,
    endsAt: null,
    completePromptTaskId: null,
  };
}

function FocusTimerCompletionPrompt() {
  const { completePromptTaskId, dismissCompletionPrompt, markPromptTaskDone } = useFocusTimer();
  const { mirror } = useMirror();

  if (completePromptTaskId == null) return null;

  const task = mirror.tasks.find((row) => row.id === completePromptTaskId);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[380px] rounded-[24px] border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Session complete</p>
        <h2 className="mt-2 text-xl font-semibold text-text-primary">Mark task as done?</h2>
        {task ? (
          <p className="mt-2 text-sm text-text-secondary">
            &ldquo;{task.title?.trim() || `Task ${completePromptTaskId}`}&rdquo;
          </p>
        ) : null}
        <p className="mt-1 text-sm text-text-muted">
          Great work! Do you want to mark this task as complete?
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={markPromptTaskDone}
            className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-extrabold text-white hover:bg-accent-hover"
          >
            Yes, mark complete
          </button>
          <button
            type="button"
            onClick={dismissCompletionPrompt}
            className="flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm font-extrabold text-text-primary hover:bg-surface"
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}

function FocusTimerBubble() {
  const router = useRouter();
  const {
    hydrated,
    running,
    paused,
    remainingSeconds,
    sessionTitle,
    togglePause,
    stopTimer,
  } = useFocusTimer();

  if (!hydrated || (!running && !paused)) return null;

  return (
    <div
      className={[
        'fixed right-3 top-[76px] z-[55] max-w-[calc(100vw-24px)] transition-all duration-300 md:right-6 md:top-[88px]',
        running || paused ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      ].join(' ')}
    >
      <div
        className="flex min-h-[56px] items-center gap-3 rounded-full px-3 py-2 text-left text-text-primary shadow-[0_18px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/5"
        style={{
          background:
            'light-dark(rgba(255,255,255,0.72), rgba(20,18,44,0.58))',
          border: '1px solid light-dark(rgba(124,105,255,0.24), rgba(168,139,255,0.28))',
          backdropFilter: 'blur(18px) saturate(140%)',
          WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/app/focus-timer')}
          aria-label="Open focus timer"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span
            className={[
              'inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-accent',
              running ? 'animate-pulse' : 'opacity-60',
            ].join(' ')}
          />
          <span className="text-sm font-extrabold tabular-nums text-text-primary">
            {formatClock(remainingSeconds)}
          </span>
          <span className="min-w-0 truncate text-xs font-semibold text-text-secondary">
            {sessionTitle.trim() || 'Focus session'} · {paused ? 'Paused' : 'Running'}
          </span>
        </button>
        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? 'Resume focus timer' : 'Pause focus timer'}
          className="rounded-full px-3 py-2 text-xs font-extrabold text-text-primary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={stopTimer}
          aria-label="Stop focus timer"
          className="rounded-full px-3 py-2 text-xs font-extrabold text-rose-500 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const { commitMirror, persistNow } = useMirror();
  const [state, setState] = useState<PersistedTimerState>(() => defaultState());
  const [hydrated, setHydrated] = useState(false);
  const finishingRef = useRef(false);

  const finalizeSession = useCallback(
    (nextState?: Partial<PersistedTimerState>) => {
      const latest = nextState ? { ...state, ...nextState } : state;
      const elapsedMinutes = Math.max(
        1,
        Math.round((latest.durationSeconds - latest.remainingSeconds) / 60),
      );
      const nowIso = new Date().toISOString();
      const startedAt = latest.startedAt;

      if (startedAt != null && latest.durationSeconds > 0) {
        commitMirror((prev) => ({
          ...prev,
          sessions: [
            ...prev.sessions,
            {
              id: nextNumericId(prev.sessions),
              subjectId: null,
              taskId: latest.connectedTaskId,
              title: latest.sessionTitle.trim() || 'Focus session',
              startedAt: new Date(startedAt).toISOString(),
              endedAt: nowIso,
              focusMinutes: elapsedMinutes,
              completed: 1,
              createdAt: nowIso,
            },
          ],
        }));
        void persistNow();
      }

      const resetState: PersistedTimerState = {
        ...defaultState(),
        status: 'completed',
        completePromptTaskId: latest.connectedTaskId,
      };
      setState(resetState);
      writeStoredState(resetState);
      window.setTimeout(() => {
        setState((current) => {
          if (current.status !== 'completed') return current;
          const next = { ...current, status: 'idle' as const };
          if (next.completePromptTaskId == null) {
            clearStoredState();
          } else {
            writeStoredState(next);
          }
          return next;
        });
      }, 50);
    },
    [commitMirror, persistNow, state],
  );

  useEffect(() => {
    const stored = readStoredState();
    if (!stored) {
      window.setTimeout(() => setHydrated(true), 0);
      return;
    }

    if (stored.status === 'running' && stored.endsAt != null) {
      const remainingSeconds = Math.max(0, Math.ceil((stored.endsAt - Date.now()) / 1000));
      if (remainingSeconds <= 0) {
        window.setTimeout(() => {
          finalizeSession({
            ...stored,
            remainingSeconds: 0,
          });
          setHydrated(true);
        }, 0);
        return;
      }
      const nextState = { ...stored, remainingSeconds };
      window.setTimeout(() => {
        setState(nextState);
        writeStoredState(nextState);
        setHydrated(true);
      }, 0);
      return;
    }

    window.setTimeout(() => {
      setState(stored);
      setHydrated(true);
    }, 0);
  }, [finalizeSession]);

  useEffect(() => {
    if (!hydrated || state.status !== 'running' || state.endsAt == null) return;

    const tick = () => {
      const remainingSeconds = Math.max(0, Math.ceil((state.endsAt as number - Date.now()) / 1000));
      if (remainingSeconds <= 0) {
        if (finishingRef.current) return;
        finishingRef.current = true;
        finalizeSession({
          remainingSeconds: 0,
        });
        finishingRef.current = false;
        return;
      }
      setState((current) => {
        const next = { ...current, remainingSeconds };
        writeStoredState(next);
        return next;
      });
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [finalizeSession, hydrated, state.endsAt, state.status]);

  const startTimer = useCallback(
    (params: { durationSeconds: number; sessionTitle: string; connectedTaskId: number | null }) => {
      const nextState: PersistedTimerState = {
        startedAt: Date.now(),
        durationSeconds: params.durationSeconds,
        remainingSeconds: params.durationSeconds,
        status: 'running',
        sessionTitle: params.sessionTitle,
        connectedTaskId: params.connectedTaskId,
        pausedAt: null,
        endsAt: Date.now() + params.durationSeconds * 1000,
        completePromptTaskId: null,
      };
      setState(nextState);
      writeStoredState(nextState);
    },
    [],
  );

  const pauseTimer = useCallback(() => {
    setState((current) => {
      if (current.status !== 'running') return current;
      const remainingSeconds =
        current.endsAt != null ? Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)) : current.remainingSeconds;
      const next = {
        ...current,
        status: 'paused' as const,
        remainingSeconds,
        pausedAt: Date.now(),
        endsAt: null,
      };
      writeStoredState(next);
      return next;
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setState((current) => {
      if (current.status !== 'paused') return current;
      const next = {
        ...current,
        status: 'running' as const,
        pausedAt: null,
        endsAt: Date.now() + current.remainingSeconds * 1000,
      };
      writeStoredState(next);
      return next;
    });
  }, []);

  const togglePause = useCallback(() => {
    setState((current) => {
      if (current.status === 'running') {
        const remainingSeconds =
          current.endsAt != null ? Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)) : current.remainingSeconds;
        const next = {
          ...current,
          status: 'paused' as const,
          remainingSeconds,
          pausedAt: Date.now(),
          endsAt: null,
        };
        writeStoredState(next);
        return next;
      }
      if (current.status === 'paused') {
        const next = {
          ...current,
          status: 'running' as const,
          pausedAt: null,
          endsAt: Date.now() + current.remainingSeconds * 1000,
        };
        writeStoredState(next);
        return next;
      }
      return current;
    });
  }, []);

  const addTime = useCallback((minutes: number) => {
    const addSeconds = minutes * 60;
    setState((current) => {
      if (current.status === 'idle' || current.status === 'completed') return current;
      const next = {
        ...current,
        durationSeconds: current.durationSeconds + addSeconds,
        remainingSeconds: current.remainingSeconds + addSeconds,
        endsAt:
          current.status === 'running' && current.endsAt != null
            ? current.endsAt + addSeconds * 1000
            : current.endsAt,
      };
      writeStoredState(next);
      return next;
    });
  }, []);

  const stopTimer = useCallback(() => {
    finalizeSession();
  }, [finalizeSession]);

  const dismissCompletionPrompt = useCallback(() => {
    setState((current) => {
      const next = {
        ...current,
        completePromptTaskId: null,
      };
      if (next.status === 'idle') {
        clearStoredState();
      } else {
        writeStoredState(next);
      }
      return next;
    });
  }, []);

  const markPromptTaskDone = useCallback(() => {
    setState((current) => {
      const taskId = current.completePromptTaskId;
      if (taskId != null) {
        commitMirror((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, status: 'done' } : task)),
        }));
      }
      const next = {
        ...current,
        completePromptTaskId: null,
      };
      clearStoredState();
      return next;
    });
  }, [commitMirror]);

  const value = useMemo(
    () =>
      ({
        hydrated,
        status: state.status,
        running: state.status === 'running',
        paused: state.status === 'paused',
        durationSeconds: state.durationSeconds,
        remainingSeconds: state.remainingSeconds,
        sessionTitle: state.sessionTitle,
        connectedTaskId: state.connectedTaskId,
        completePromptTaskId: state.completePromptTaskId,
        startTimer,
        pauseTimer,
        resumeTimer,
        togglePause,
        addTime,
        stopTimer,
        dismissCompletionPrompt,
        markPromptTaskDone,
      }) satisfies FocusTimerContextValue,
    [
      addTime,
      dismissCompletionPrompt,
      hydrated,
      markPromptTaskDone,
      pauseTimer,
      resumeTimer,
      startTimer,
      state.completePromptTaskId,
      state.connectedTaskId,
      state.durationSeconds,
      state.remainingSeconds,
      state.sessionTitle,
      state.status,
      stopTimer,
      togglePause,
    ],
  );

  return (
    <FocusTimerCtx.Provider value={value}>
      {children}
      <FocusTimerBubble />
      <FocusTimerCompletionPrompt />
    </FocusTimerCtx.Provider>
  );
}

export function useFocusTimer() {
  const ctx = useContext(FocusTimerCtx);
  if (!ctx) throw new Error('useFocusTimer must be inside FocusTimerProvider');
  return ctx;
}
