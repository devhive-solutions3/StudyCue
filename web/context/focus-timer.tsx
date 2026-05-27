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
import { playFocusTimerCompleteSound, preloadFocusTimerSound } from '@/lib/focus-timer-sound';
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

export type FocusCompletionModal = {
  open: true;
  durationMinutes: number;
  sessionTitle: string;
  connectedTaskId: number | null;
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
  completionModal: FocusCompletionModal | null;
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
  dismissCompletionModal: () => void;
  dismissCompletionPrompt: () => void;
  markPromptTaskDone: () => void;
};

function isTaskDone(status: string | null | undefined) {
  return ['done', 'completed'].includes((status ?? '').toLowerCase());
}

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
  const { commitMirror, persistNow, mirror } = useMirror();
  const [state, setState] = useState<PersistedTimerState>(() => defaultState());
  const [hydrated, setHydrated] = useState(false);
  const [completionModal, setCompletionModal] = useState<FocusCompletionModal | null>(null);
  const finishingRef = useRef(false);
  const handledSessionRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const finalizeSession = useCallback(
    (snapshot?: PersistedTimerState) => {
      const latest = snapshot ?? stateRef.current;
      const startedAt = latest.startedAt;
      if (startedAt == null) return;
      if (handledSessionRef.current === startedAt) return;
      handledSessionRef.current = startedAt;

      const timerReachedZero = latest.remainingSeconds <= 0;
      if (timerReachedZero) {
        playFocusTimerCompleteSound();
      }

      const elapsedMinutes = Math.max(
        1,
        Math.round((latest.durationSeconds - latest.remainingSeconds) / 60),
      );
      const nowIso = new Date().toISOString();

      if (latest.durationSeconds > 0) {
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

      setCompletionModal({
        open: true,
        durationMinutes: elapsedMinutes,
        sessionTitle: latest.sessionTitle,
        connectedTaskId: latest.connectedTaskId,
      });

      const resetState = defaultState();
      setState(resetState);
      clearStoredState();
      finishingRef.current = false;
    },
    [commitMirror, persistNow],
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
      const endsAt = stateRef.current.endsAt;
      if (endsAt == null) return;
      const remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      if (remainingSeconds <= 0) {
        if (finishingRef.current) return;
        finishingRef.current = true;
        finalizeSession({
          ...stateRef.current,
          remainingSeconds: 0,
        });
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
      handledSessionRef.current = null;
      finishingRef.current = false;
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
      preloadFocusTimerSound();
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
    finalizeSession(stateRef.current);
  }, [finalizeSession]);

  const dismissCompletionModal = useCallback(() => {
    const taskId = completionModal?.connectedTaskId ?? null;
    setCompletionModal(null);
    if (taskId == null) return;
    const task = mirror.tasks.find((row) => row.id === taskId);
    if (!task || isTaskDone(task.status)) return;
    const next: PersistedTimerState = {
      ...defaultState(),
      completePromptTaskId: taskId,
    };
    setState(next);
    writeStoredState(next);
  }, [completionModal?.connectedTaskId, mirror.tasks]);

  useEffect(() => {
    if (!hydrated || state.status !== 'running') return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hydrated, state.status]);

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
        completionModal,
        startTimer,
        pauseTimer,
        resumeTimer,
        togglePause,
        addTime,
        stopTimer,
        dismissCompletionModal,
        dismissCompletionPrompt,
        markPromptTaskDone,
      }) satisfies FocusTimerContextValue,
    [
      addTime,
      completionModal,
      dismissCompletionModal,
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
    </FocusTimerCtx.Provider>
  );
}

export function useFocusTimer() {
  const ctx = useContext(FocusTimerCtx);
  if (!ctx) throw new Error('useFocusTimer must be inside FocusTimerProvider');
  return ctx;
}
