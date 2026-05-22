'use client';

import { useMemo, useState } from 'react';
import * as React from 'react';

import { useDashboardUi } from '@/context/dashboard-ui';
import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

const QUICK_MINUTES = [25, 45, 60, 120];

function words(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function overlapScore(source: string[], target: string[]): number {
  if (source.length === 0 || target.length === 0) return 0;
  const targetSet = new Set(target);
  let score = 0;
  source.forEach((token) => {
    if (targetSet.has(token)) score += 1;
  });
  return score;
}

function isTaskDone(status: string | null | undefined) {
  return ['done', 'completed'].includes((status ?? '').toLowerCase());
}

export default function FocusRoutePage() {
  const { mirror, commitMirror, persistNow } = useMirror();
  const { setFocusLocked } = useDashboardUi();

  const [sessionTitle, setSessionTitle] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskSelectionTouched, setTaskSelectionTouched] = useState(false);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  // "Mark task complete?" popup after session ends
  const [completePromptTaskId, setCompletePromptTaskId] = useState<number | null>(null);

  const pauseRef = React.useRef<number | null>(null);
  const endsAtMsRef = React.useRef<number | null>(null);
  const remainingSecondsRef = React.useRef(remainingSeconds);
  const totalSecondsRef = React.useRef(totalSeconds);
  remainingSecondsRef.current = remainingSeconds;
  totalSecondsRef.current = totalSeconds;
  const completionAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const fallbackAudioContextRef = React.useRef<AudioContext | null>(null);
  const hasUnlockedAudioRef = React.useRef(false);
  const hasPlayedCompletionSoundRef = React.useRef(false);
  const completionSoundPendingRef = React.useRef(false);
  const isNaturalCompletionPendingRef = React.useRef(false);

  React.useEffect(() => {
    completionAudioRef.current = new Audio('/sounds/timer.mp3');
    completionAudioRef.current.preload = 'auto';
    completionAudioRef.current.volume = 0.75;
    completionAudioRef.current.load();

    return () => {
      if (completionAudioRef.current) {
        completionAudioRef.current.pause();
        completionAudioRef.current = null;
      }
      if (fallbackAudioContextRef.current) {
        void fallbackAudioContextRef.current.close().catch(() => undefined);
        fallbackAudioContextRef.current = null;
      }
    };
  }, []);

  const playFallbackChime = React.useCallback(() => {
    try {
      const audioContext =
        fallbackAudioContextRef.current ??
        (() => {
          const audioContextCtor =
            window.AudioContext ??
            (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

          if (!audioContextCtor) return null;
          const context = new audioContextCtor();
          fallbackAudioContextRef.current = context;
          return context;
        })();

      if (!audioContext) return;
      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined);
      }

      const notes = [
        { frequency: 659.25, start: 0, duration: 0.12 },
        { frequency: 783.99, start: 0.13, duration: 0.14 },
        { frequency: 987.77, start: 0.29, duration: 0.18 },
      ];

      notes.forEach(({ frequency, start, duration }) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + start);

        gain.gain.setValueAtTime(0.0001, audioContext.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + start + duration);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(audioContext.currentTime + start);
        oscillator.stop(audioContext.currentTime + start + duration + 0.03);
      });
    } catch (error) {
      console.warn('Fallback chime failed:', error);
    }
  }, []);

  const playCompletionSound = React.useCallback(async (options?: { retry?: boolean }) => {
    if (hasPlayedCompletionSoundRef.current && !options?.retry) return;
    if (options?.retry) {
      hasPlayedCompletionSoundRef.current = false;
    }

    try {
      const audio = completionAudioRef.current;

      if (audio) {
        if (fallbackAudioContextRef.current?.state === 'suspended') {
          await fallbackAudioContextRef.current.resume().catch(() => undefined);
        }
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.75;
        await audio.play();
        hasPlayedCompletionSoundRef.current = true;
        completionSoundPendingRef.current = false;
        return;
      }
    } catch (error) {
      console.warn('Completion sound failed, using fallback chime:', error);
      completionSoundPendingRef.current = true;
    }

    hasPlayedCompletionSoundRef.current = true;
    playFallbackChime();
  }, [playFallbackChime]);

  const unlockCompletionAudio = React.useCallback(async () => {
    if (hasUnlockedAudioRef.current || !completionAudioRef.current) return;

    try {
      const audioContextCtor =
        window.AudioContext ??
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!fallbackAudioContextRef.current && audioContextCtor) {
        fallbackAudioContextRef.current = new audioContextCtor();
      }
      if (fallbackAudioContextRef.current?.state === 'suspended') {
        await fallbackAudioContextRef.current.resume();
      }

      completionAudioRef.current.muted = true;
      await completionAudioRef.current.play();
      completionAudioRef.current.pause();
      completionAudioRef.current.currentTime = 0;
      completionAudioRef.current.muted = false;
      hasUnlockedAudioRef.current = true;
    } catch (error) {
      console.warn('Audio unlock failed:', error);
    }
  }, []);

  const finishSession = React.useCallback(() => {
    isNaturalCompletionPendingRef.current = false;
    const nowIso = new Date().toISOString();
    const elapsed = Math.max(
      1,
      Math.round((totalSecondsRef.current - remainingSecondsRef.current) / 60),
    );
    const linkedTaskId = selectedTaskId;

    commitMirror((prev) => ({
      ...prev,
      sessions: [
        ...prev.sessions,
        {
          id: nextNumericId(prev.sessions),
          subjectId: null,
          taskId: linkedTaskId,
          title: sessionTitle.trim() || 'Focus session',
          startedAt: startedAtMs ? new Date(startedAtMs).toISOString() : nowIso,
          endedAt: nowIso,
          focusMinutes: elapsed,
          completed: 1,
          createdAt: nowIso,
        },
      ],
    }));

    void persistNow();

    endsAtMsRef.current = null;
    setRunning(false);
    setPaused(false);
    setRemainingSeconds(resolveMinutes() * 60);
    setTotalSeconds(resolveMinutes() * 60);
    setStartedAtMs(null);
    pauseRef.current = null;

    if (linkedTaskId != null) {
      setCompletePromptTaskId(linkedTaskId);
    }
  }, [commitMirror, persistNow, selectedTaskId, sessionTitle, startedAtMs]);

  const handleNaturalCompletion = React.useCallback(async () => {
    if (isNaturalCompletionPendingRef.current) return;
    const endsAt = endsAtMsRef.current;
    const left =
      endsAt != null ? Math.ceil((endsAt - Date.now()) / 1000) : remainingSeconds;
    if (left > 0) return;

    isNaturalCompletionPendingRef.current = true;
    remainingSecondsRef.current = 0;
    setRemainingSeconds(0);
    await playCompletionSound();
    finishSession();
  }, [finishSession, playCompletionSound]);

  React.useEffect(() => {
    if (!running || paused) return;

    const tick = () => {
      const endsAt = endsAtMsRef.current;
      if (endsAt == null) return;
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        void handleNaturalCompletion();
      }
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [handleNaturalCompletion, paused, running]);

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      if (completionSoundPendingRef.current) {
        void playCompletionSound({ retry: true });
      } else if (fallbackAudioContextRef.current?.state === 'suspended') {
        void fallbackAudioContextRef.current.resume().catch(() => undefined);
      }

      if (!running || paused || endsAtMsRef.current == null) return;
      const left = Math.max(0, Math.ceil((endsAtMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        void handleNaturalCompletion();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [handleNaturalCompletion, paused, playCompletionSound, running]);

  React.useEffect(() => {
    setFocusLocked(running);
    return () => setFocusLocked(false);
  }, [running, setFocusLocked]);

  const logs = useMemo(() => {
    return [...mirror.sessions]
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, 20);
  }, [mirror.sessions]);

  const categoryLookup = useMemo(
    () => new Map(mirror.taskCategories.map((category) => [category.id, category])),
    [mirror.taskCategories],
  );

  const taskLookup = useMemo(
    () => new Map(mirror.tasks.map((task) => [task.id, task])),
    [mirror.tasks],
  );

  const categories = useMemo(
    () => [...mirror.taskCategories].sort((a, b) => a.name.localeCompare(b.name)),
    [mirror.taskCategories],
  );

  const openTasks = useMemo(
    () => mirror.tasks.filter((task) => !isTaskDone(task.status)),
    [mirror.tasks],
  );

  const tasksInSelectedCategory = useMemo(() => {
    if (selectedCategoryId == null) return openTasks;
    return openTasks.filter((task) => task.categoryId === selectedCategoryId);
  }, [openTasks, selectedCategoryId]);

  const suggestedTaskId = useMemo(() => {
    const titleTokens = words(sessionTitle);
    if (titleTokens.length === 0) return null;

    let bestTaskId: number | null = null;
    let bestScore = 0;

    mirror.tasks.forEach((task) => {
      if (!task.title?.trim()) return;
      const status = (task.status ?? '').toLowerCase();
      if (status === 'done' || status === 'completed') return;

      const taskTokens = words(task.title);
      const categoryTokens = words(categoryLookup.get(task.categoryId ?? -1)?.name ?? '');
      const score = overlapScore(titleTokens, taskTokens) * 2 + overlapScore(titleTokens, categoryTokens);

      if (score > bestScore) {
        bestScore = score;
        bestTaskId = task.id;
      }
    });

    return bestScore > 0 ? bestTaskId : null;
  }, [sessionTitle, mirror.tasks, categoryLookup]);

  React.useEffect(() => {
    if (taskSelectionTouched) return;
    if (suggestedTaskId == null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTaskId(suggestedTaskId);
    setSelectedCategoryId(taskLookup.get(suggestedTaskId)?.categoryId ?? null);
  }, [suggestedTaskId, taskSelectionTouched, taskLookup]);

  React.useEffect(() => {
    if (selectedTaskId == null) return;
    const task = taskLookup.get(selectedTaskId);
    if (task && isTaskDone(task.status)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, taskLookup]);

  function resolveMinutes() {
    const custom = Number(customMinutes);
    if (Number.isFinite(custom) && custom >= 1) {
      return Math.round(custom);
    }
    return selectedMinutes;
  }

  async function startSession() {
    await unlockCompletionAudio();
    const mins = resolveMinutes();
    const secs = mins * 60;
    hasPlayedCompletionSoundRef.current = false;
    completionSoundPendingRef.current = false;
    isNaturalCompletionPendingRef.current = false;
    endsAtMsRef.current = Date.now() + secs * 1000;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setRunning(true);
    setPaused(false);
    setStartedAtMs(Date.now());
    pauseRef.current = null;
  }

  function togglePause() {
    if (!running) return;
    if (!paused) {
      pauseRef.current = Date.now();
      setPaused(true);
      return;
    }
    endsAtMsRef.current = Date.now() + remainingSeconds * 1000;
    if (pauseRef.current && startedAtMs) {
      const pausedFor = Date.now() - pauseRef.current;
      setStartedAtMs(startedAtMs + pausedFor);
    }
    pauseRef.current = null;
    setPaused(false);
  }

  function addTime(minutes: number) {
    if (!running) return;
    const addSeconds = minutes * 60;
    endsAtMsRef.current = (endsAtMsRef.current ?? Date.now()) + addSeconds * 1000;
    setRemainingSeconds((prev) => prev + addSeconds);
    setTotalSeconds((prev) => prev + addSeconds);
  }

  if (running) {
    return (
      <div className="mx-auto flex min-h-[72vh] max-w-[940px] items-center justify-center">
        <section className="w-full rounded-[32px] border border-border bg-surface p-8 text-center shadow-[var(--shadow-md)]">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Stay focused</p>
          <h1 className="mt-4 text-[clamp(64px,8vw,108px)] font-extrabold leading-[0.92] tracking-[-0.08em] text-accent">{formatClock(remainingSeconds)}</h1>
          <p className="mt-2 text-sm text-text-secondary">{sessionTitle.trim() || 'Focus session'}</p>
          {selectedTaskId != null ? (
            <p className="mt-1 text-xs text-text-muted">
              Linked task: {taskLookup.get(selectedTaskId)?.title?.trim() || 'Task'}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={togglePause}
              className="rounded-full border border-border bg-surface-2 px-6 py-3 text-base font-extrabold text-text-primary hover:bg-surface"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => addTime(5)}
              className="rounded-full border border-border bg-surface-2 px-6 py-3 text-base font-extrabold text-text-primary hover:bg-surface"
            >
              +5 min
            </button>
            <button
              type="button"
              onClick={finishSession}
              className="rounded-full bg-rose-500 px-6 py-3 text-base font-extrabold text-white hover:bg-rose-400"
            >
              End session
            </button>
          </div>
        </section>
      </div>
    );
  }

  const promptTask = completePromptTaskId != null ? taskLookup.get(completePromptTaskId) : null;
  const selectedDisplay = formatClock(resolveMinutes() * 60);

  return (
    <>
    {completePromptTaskId != null && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
        <div className="w-full max-w-[380px] rounded-[24px] border border-border bg-surface p-6 shadow-[var(--shadow-md)]">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Session complete</p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">Mark task as done?</h2>
          {promptTask && (
            <p className="mt-2 text-sm text-text-secondary">
              &ldquo;{promptTask.title?.trim() || `Task ${completePromptTaskId}`}&rdquo;
            </p>
          )}
          <p className="mt-1 text-sm text-text-muted">
            Great work! Do you want to mark this task as complete?
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                commitMirror((prev) => ({
                  ...prev,
                  tasks: prev.tasks.map((t) =>
                    t.id === completePromptTaskId ? { ...t, status: 'done' } : t,
                  ),
                }));
                setCompletePromptTaskId(null);
              }}
              className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-extrabold text-white hover:bg-accent-hover"
            >
              Yes, mark complete
            </button>
            <button
              type="button"
              onClick={() => setCompletePromptTaskId(null)}
              className="flex-1 rounded-full border border-border bg-surface-2 px-4 py-2.5 text-sm font-extrabold text-text-primary hover:bg-surface"
            >
              Not yet
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="mx-auto max-w-[1040px] space-y-[22px]">
      <section className="sc-panel min-h-[520px] rounded-[32px] p-[34px] shadow-[var(--sc-shadow-md)]">
        <div className="text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-text-muted">Focus timer</p>
          <h1 className="sc-page-title mt-2 text-text-primary">Start a focus session</h1>
          <div className="my-[28px] text-[clamp(72px,10vw,124px)] font-extrabold leading-[0.95] tracking-[-0.08em] text-accent">
            {selectedDisplay}
          </div>
          <p className="mx-auto max-w-xl text-sm text-text-secondary">
            Pick a duration, connect a task if useful, then lock into one calm study block.
          </p>
        </div>

        <div className="mt-8">
        <p className="text-sm font-extrabold text-text-secondary">Select duration</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_MINUTES.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => {
                setSelectedMinutes(mins);
                setCustomMinutes('');
              }}
              className={[
                'min-h-[46px] rounded-full px-[22px] text-base font-extrabold',
                selectedMinutes === mins && !customMinutes
                  ? 'bg-accent text-white shadow-[var(--shadow-accent)]'
                  : 'border border-border bg-surface-2 text-text-primary hover:bg-surface',
              ].join(' ')}
            >
              {mins >= 60 ? `${Math.floor(mins / 60)} hr` : `${mins} min`}
            </button>
          ))}
        </div>
        </div>

        <div className="mt-6">
        <p className="text-sm font-extrabold text-text-secondary">Or enter custom minutes</p>
        <input
          value={customMinutes}
          onChange={(e) => setCustomMinutes(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="e.g. 35"
          className="sc-input mt-2 min-h-[52px] rounded-[15px] text-base"
        />
        </div>

        <div className="mt-6">
        <p className="text-sm font-extrabold text-text-secondary">Session title (optional)</p>
        <input
          value={sessionTitle}
          onChange={(e) => {
            setSessionTitle(e.target.value);
            setTaskSelectionTouched(false);
          }}
          placeholder="e.g. Chemistry review"
          className="sc-input mt-2 min-h-[52px] rounded-[15px] text-base"
        />
        </div>

        <div className="mt-6">
        <p className="text-sm font-extrabold text-text-secondary">Connect to a task (optional)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <select
            value={selectedCategoryId == null ? '' : String(selectedCategoryId)}
            onChange={(e) => {
              const raw = e.target.value;
              setSelectedCategoryId(raw ? Number(raw) : null);
              setSelectedTaskId(null);
              setTaskSelectionTouched(true);
            }}
            className="sc-input min-h-[52px] w-full appearance-none rounded-[15px] pr-10"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={selectedTaskId == null ? '' : String(selectedTaskId)}
            onChange={(e) => {
              const raw = e.target.value;
              setSelectedTaskId(raw ? Number(raw) : null);
              setTaskSelectionTouched(true);
            }}
            className="sc-input min-h-[52px] w-full appearance-none rounded-[15px] pr-10"
          >
            <option value="">No linked task</option>
            {tasksInSelectedCategory.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title?.trim() || `Task ${task.id}`}
              </option>
            ))}
          </select>
        </div>
        </div>

        {suggestedTaskId != null && selectedTaskId !== suggestedTaskId ? (
          <button
            type="button"
            onClick={() => {
              setSelectedTaskId(suggestedTaskId);
              setSelectedCategoryId(taskLookup.get(suggestedTaskId)?.categoryId ?? null);
              setTaskSelectionTouched(true);
            }}
            className="sc-btn-secondary mt-3 text-xs"
          >
            Suggested match: {taskLookup.get(suggestedTaskId)?.title?.trim() || 'Task'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            void startSession();
          }}
          className="mt-8 min-h-[64px] w-full rounded-full bg-accent px-6 text-[18px] font-extrabold text-white shadow-[var(--shadow-accent)] hover:bg-accent-hover"
        >
          Start session
        </button>
      </section>

      <section className="sc-panel rounded-[24px]">
        <div className="sc-panel-header">
          <h2 className="text-lg font-extrabold text-text-primary">Past focus sessions</h2>
        </div>
        <div className="space-y-2 p-5">
          {logs.length === 0 ? (
            <p className="text-sm text-text-muted">No sessions yet.</p>
          ) : (
            logs.map((session) => (
              <div key={session.id} className="min-h-[64px] rounded-[16px] border border-border bg-surface-2 px-[14px] py-3">
                <p className="text-sm font-bold text-text-primary">{session.title?.trim() || 'Focus session'}</p>
                <p className="text-xs text-text-muted">
                  {session.focusMinutes ?? 0} min · {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Saved'}
                </p>
                {session.taskId != null ? (
                  <p className="text-xs text-text-muted">
                    Linked task: {taskLookup.get(session.taskId)?.title?.trim() || `Task ${session.taskId}`}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
    </>
  );
}
