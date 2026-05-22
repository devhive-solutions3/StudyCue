/**
 * Firestore cloud mirror for cross-device sync (mobile ↔ web MVP).
 * Single document `users/{uid}/mirror/snapshot` with JSON payload.
 */

import type { User } from '@firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import type { CloudMirrorV1 } from '../types/studycue';

import { db } from './firebase';
import { initDatabase } from './db';

export const MIRROR_DOC_ID = 'snapshot';

export function mirrorDocRef(uid: string) {
  return doc(db, 'users', uid, 'mirror', MIRROR_DOC_ID);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleMirrorPush(user: User | null): void {
  if (!user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushMirrorNow(user).catch((e) => {
      console.warn('[cloud-sync] push failed', e);
    });
  }, 2000);
}

export async function pushMirrorNow(user: User): Promise<void> {
  const { loadUserAppSnapshot, loadUserPreferences } = await import('./user-app-data');
  const snap = await loadUserAppSnapshot(user);
  if (snap.localUserId == null) return;

  const prefs = await loadUserPreferences(snap.localUserId);
  const payload: CloudMirrorV1 = {
    schemaVersion: 1,
    taskCategories: snap.taskCategories,
    classes: snap.classes,
    tasks: snap.tasks,
    sessions: snap.sessions,
    preferences: {
      preferredFocusMinutes: prefs.preferredFocusMinutes,
      preferredBreakMinutes: prefs.preferredBreakMinutes,
      dailyGoalMinutes: prefs.dailyGoalMinutes,
      energyMode: prefs.energyMode,
    },
  };

  const json = JSON.stringify(payload);
  if (json.length > 950_000) {
    console.warn('[cloud-sync] mirror payload unusually large — may exceed Firestore 1MiB limit');
  }

  await setDoc(mirrorDocRef(user.uid), {
    json,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchMirrorPayload(user: User): Promise<CloudMirrorV1 | null> {
  const snap = await getDoc(mirrorDocRef(user.uid));
  if (!snap.exists()) return null;
  const data = snap.data() as { json?: string };
  if (!data.json) return null;
  try {
    return JSON.parse(data.json) as CloudMirrorV1;
  } catch {
    return null;
  }
}

export async function deleteMirror(user: User): Promise<void> {
  await deleteDoc(mirrorDocRef(user.uid));
}

export async function restoreCloudOverwrite(user: User): Promise<void> {
  const mirror = await fetchMirrorPayload(user);
  if (!mirror || mirror.schemaVersion !== 1) {
    throw new Error('No cloud backup found.');
  }
  await applyMirrorToLocalSqlite(user, mirror);
}

/**
 * Overwrites local SQLite rows for this user with mirror contents.
 */
export async function applyMirrorToLocalSqlite(
  firebaseUser: User,
  mirror: CloudMirrorV1,
): Promise<void> {
  const { ensureLocalUser } = await import('./user-app-data');
  const localUser = await ensureLocalUser(firebaseUser);
  const userId = localUser.id;

  const sqlDb = await initDatabase();
  await sqlDb.execAsync('BEGIN TRANSACTION');
  await sqlDb.runAsync('DELETE FROM study_sessions WHERE userId = ?', [userId]);
  await sqlDb.runAsync('DELETE FROM tasks WHERE userId = ?', [userId]);
  await sqlDb.runAsync('DELETE FROM classes WHERE userId = ?', [userId]);
  await sqlDb.runAsync('DELETE FROM task_categories WHERE userId = ?', [userId]);
  await sqlDb.runAsync('DELETE FROM ai_preferences WHERE userId = ?', [userId]);
  await sqlDb.execAsync('COMMIT');

  for (const c of mirror.taskCategories) {
    await sqlDb.runAsync(
      'INSERT INTO task_categories (id, userId, name, slug) VALUES (?, ?, ?, ?)',
      [c.id, userId, c.name, c.slug],
    );
  }

  for (const cl of mirror.classes) {
    await sqlDb.runAsync(
      `INSERT INTO classes (id, userId, title, weekday, startTime, endTime, location, notes, recurrence, eventType, specificDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cl.id,
        userId,
        cl.title,
        cl.weekday,
        cl.startTime,
        cl.endTime,
        cl.location,
        null,
        cl.recurrence,
        cl.eventType,
        cl.specificDate,
      ],
    );
  }

  for (const t of mirror.tasks) {
    await sqlDb.runAsync(
      `INSERT INTO tasks (id, userId, categoryId, title, dueAt, estimatedMinutes, difficulty, priority, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        userId,
        t.categoryId,
        t.title,
        t.dueAt,
        t.estimatedMinutes,
        null,
        null,
        t.status ?? 'pending',
        null,
      ],
    );
  }

  for (const s of mirror.sessions) {
    const completedNum = typeof s.completed === 'number' ? s.completed : 0;
    const completed = completedNum === 1 ? 1 : 0;
    await sqlDb.runAsync(
      `INSERT INTO study_sessions (id, userId, subjectId, taskId, startedAt, endedAt, focusMinutes, breakMinutes, sessionType, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        userId,
        s.subjectId ?? null,
        s.taskId ?? null,
        s.startedAt,
        s.endedAt,
        s.focusMinutes,
        null,
        'focus',
        completed,
      ],
    );
  }

  if (mirror.preferences) {
    const p = mirror.preferences;
    await sqlDb.runAsync(
      `INSERT INTO ai_preferences (userId, preferredFocusMinutes, preferredBreakMinutes, dailyGoalMinutes, energyMode)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, p.preferredFocusMinutes, p.preferredBreakMinutes, p.dailyGoalMinutes, p.energyMode],
    );
  }
}
