'use client';

import type { CloudMirrorV1 } from '@studycue/types';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
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

import { getFirebaseDb } from '@/lib/firebase-client';
import { normalizeMirror, emptyMirror } from '@/lib/mirror-bootstrap';
import { syncStudyCalendarTasks } from '@/lib/study-task-sync';

const SAVE_DEBOUNCE_MS = 850;
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INITIAL_SNAPSHOT_TIMEOUT_MS = 6000;
const IS_DEV = process.env.NODE_ENV !== 'production';

export type MirrorContextValue = {
  mirror: CloudMirrorV1;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Mutable local edits (debounced persist to Firestore). */
  commitMirror: (fn: (prev: CloudMirrorV1) => CloudMirrorV1) => void;
  persistNow: () => Promise<void>;
};

const MirrorCtx = createContext<MirrorContextValue | null>(null);

export function MirrorProvider({
  uid,
  children,
}: {
  uid: string;
  children: ReactNode;
}) {
  const [mirror, setMirror] = useState<CloudMirrorV1>(() => emptyMirror());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<CloudMirrorV1>(mirror);

  useEffect(() => {
    latestRef.current = mirror;
  }, [mirror]);

  const persistNow = useCallback(async () => {
    const payload = latestRef.current;
    setSaving(true);
    try {
      const db = getFirebaseDb();
      const ref = doc(db, 'users', uid, 'mirror', 'snapshot');
      await setDoc(
        ref,
        {
          json: JSON.stringify(payload),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setError(null);
    } catch (e) {
      if (IS_DEV) console.warn('[mirror] persist failed', e);
      setError('Could not sync your latest changes right now.');
    } finally {
      setSaving(false);
    }
  }, [uid]);

  const schedulePersist = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void persistNow(), SAVE_DEBOUNCE_MS);
  }, [persistNow]);

  const commitMirror = useCallback(
    (fn: (prev: CloudMirrorV1) => CloudMirrorV1) => {
      setMirror((prev) => {
        const next = fn(prev);
        latestRef.current = next;
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  useEffect(() => {
    const db = getFirebaseDb();
    const ref = doc(db, 'users', uid, 'mirror', 'snapshot');
    let didInit = false;
    const seedEmptyMirror = () => {
      if (didInit) return;
      didInit = true;
      const seed = emptyMirror();
      setMirror(seed);
      latestRef.current = seed;
      setLoading(false);
      void persistNow().catch(() => {});
    };
    const initFallback = window.setTimeout(seedEmptyMirror, INITIAL_SNAPSHOT_TIMEOUT_MS);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const raw = (snap.data() as { json?: string } | undefined)?.json;
        if (!raw) {
          seedEmptyMirror();
          return;
        }
        try {
          const parsed = JSON.parse(raw) as CloudMirrorV1;
          const n = syncStudyCalendarTasks(normalizeMirror(parsed));
          didInit = true;
          window.clearTimeout(initFallback);
          setMirror(n);
          latestRef.current = n;
          setError(null);
        } catch {
          setError('Could not parse cloud snapshot');
        } finally {
          setLoading(false);
        }
      },
      (snapshotErr) => {
        didInit = true;
        window.clearTimeout(initFallback);
        if (IS_DEV) console.warn('[mirror] snapshot listen failed', snapshotErr);
        setError('Cloud sync is temporarily unavailable for this account.');
        setLoading(false);
      },
    );
    return () => {
      window.clearTimeout(initFallback);
      unsub();
    };
  }, [uid, persistNow]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Background auto-sync every 15 minutes
  useEffect(() => {
    const id = window.setInterval(() => {
      void persistNow();
    }, AUTO_SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [persistNow]);

  const value = useMemo(
    () => ({
      mirror,
      loading,
      saving,
      error,
      commitMirror,
      persistNow,
    }),
    [mirror, loading, saving, error, commitMirror, persistNow],
  );

  return <MirrorCtx.Provider value={value}>{children}</MirrorCtx.Provider>;
}

export function useMirror(): MirrorContextValue {
  const c = useContext(MirrorCtx);
  if (!c) throw new Error('useMirror must be inside MirrorProvider');
  return c;
}
