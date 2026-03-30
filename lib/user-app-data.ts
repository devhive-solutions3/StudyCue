import { User } from '@firebase/auth';
import { initDatabase } from './db';

type LocalUserRow = {
  id: number;
  displayName: string | null;
  email: string | null;
};

export type ClassItem = {
  id: number;
  title: string | null;
  weekday: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

export type TaskItem = {
  id: number;
  title: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  status: string | null;
  createdAt: string | null;
};

export type StudySessionItem = {
  id: number;
  startedAt: string | null;
  endedAt: string | null;
  focusMinutes: number | null;
  completed: number | null;
  createdAt: string | null;
};

export type AppSnapshot = {
  localUserId: number | null;
  displayName: string | null;
  email: string | null;
  classes: ClassItem[];
  tasks: TaskItem[];
  sessions: StudySessionItem[];
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMPLETE_STATUSES = new Set(['completed', 'done']);

async function ensureLocalUser(firebaseUser: User): Promise<LocalUserRow> {
  const db = await initDatabase();
  const existing = await db.getFirstAsync<LocalUserRow>(
    'SELECT id, displayName, email FROM users_local WHERE firebaseUserId = ?',
    [firebaseUser.uid]
  );

  if (existing) {
    const nextDisplayName = firebaseUser.displayName ?? existing.displayName;
    const nextEmail = firebaseUser.email ?? existing.email;

    if (nextDisplayName !== existing.displayName || nextEmail !== existing.email) {
      await db.runAsync(
        'UPDATE users_local SET displayName = ?, email = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [nextDisplayName, nextEmail, existing.id]
      );
    }

    return {
      id: existing.id,
      displayName: nextDisplayName,
      email: nextEmail,
    };
  }

  const result = await db.runAsync(
    'INSERT INTO users_local (firebaseUserId, displayName, email) VALUES (?, ?, ?)',
    [firebaseUser.uid, firebaseUser.displayName, firebaseUser.email]
  );

  return {
    id: result.lastInsertRowId,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
  };
}

export async function loadUserAppSnapshot(firebaseUser: User): Promise<AppSnapshot> {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  const classes = await db.getAllAsync<ClassItem>(
    `SELECT id, title, weekday, startTime, endTime, location
     FROM classes
     WHERE userId = ?
     ORDER BY
       CASE weekday
         WHEN 'Sunday' THEN 0
         WHEN 'Monday' THEN 1
         WHEN 'Tuesday' THEN 2
         WHEN 'Wednesday' THEN 3
         WHEN 'Thursday' THEN 4
         WHEN 'Friday' THEN 5
         WHEN 'Saturday' THEN 6
         ELSE 7
       END,
       startTime ASC`,
    [localUser.id]
  );

  const tasks = await db.getAllAsync<TaskItem>(
    `SELECT id, title, dueAt, estimatedMinutes, status, createdAt
     FROM tasks
     WHERE userId = ?
     ORDER BY
       CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END,
       dueAt ASC,
       createdAt DESC`,
    [localUser.id]
  );

  const sessions = await db.getAllAsync<StudySessionItem>(
    `SELECT id, startedAt, endedAt, focusMinutes, completed, createdAt
     FROM study_sessions
     WHERE userId = ?
     ORDER BY
       CASE WHEN startedAt IS NULL THEN 1 ELSE 0 END,
       startedAt DESC,
       createdAt DESC`,
    [localUser.id]
  );

  return {
    localUserId: localUser.id,
    displayName: localUser.displayName,
    email: localUser.email,
    classes,
    tasks,
    sessions,
  };
}

export function getWeekdayName(date = new Date()) {
  return WEEKDAY_NAMES[date.getDay()];
}

export function getTodayClasses(classes: ClassItem[], date = new Date()) {
  const weekday = getWeekdayName(date);
  return classes.filter((item) => item.weekday === weekday);
}

export function getPendingTasks(tasks: TaskItem[]) {
  return tasks.filter((task) => !COMPLETE_STATUSES.has((task.status ?? '').toLowerCase()));
}

export function getCompletedTasks(tasks: TaskItem[]) {
  return tasks.filter((task) => COMPLETE_STATUSES.has((task.status ?? '').toLowerCase()));
}

export function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return '0m';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDateOnly(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getDisplayName(displayName: string | null, email: string | null) {
  if (displayName?.trim()) {
    return displayName.trim();
  }

  if (email?.trim()) {
    return email.split('@')[0];
  }

  return null;
}

export function buildActivityItems(tasks: TaskItem[], sessions: StudySessionItem[]) {
  const completedTasks = getCompletedTasks(tasks)
    .slice(0, 2)
    .map((task) => `Completed task: ${task.title ?? 'Untitled task'}`);
  const recentSessions = sessions
    .slice(0, 2)
    .map((session) => `Logged study session: ${formatMinutes(session.focusMinutes ?? 0)}`);

  return [...recentSessions, ...completedTasks].slice(0, 3);
}

export type ParsedClass = {
  title: string;
  weekday: string;
  startTime: string;
  endTime: string;
  location?: string;
};

export async function addParsedClasses(firebaseUser: User, parsedClasses: ParsedClass[]) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  for (const item of parsedClasses) {
    if (!item.title || !item.weekday) continue;
    await db.runAsync(
      'INSERT INTO classes (userId, title, weekday, startTime, endTime, location) VALUES (?, ?, ?, ?, ?, ?)',
      [
        localUser.id,
        item.title,
        item.weekday,
        item.startTime || null,
        item.endTime || null,
        item.location || null,
      ]
    );
  }
}

export async function clearAllClasses(firebaseUser: User) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  await db.runAsync('DELETE FROM classes WHERE userId = ?', [localUser.id]);
}

export type ParsedTask = {
  title: string;
  dueAt?: string;
  estimatedMinutes?: number;
};

export async function addParsedTasks(firebaseUser: User, parsedTasks: ParsedTask[]) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  for (const item of parsedTasks) {
    if (!item.title) continue;
    await db.runAsync(
      'INSERT INTO tasks (userId, title, dueAt, estimatedMinutes, status) VALUES (?, ?, ?, ?, ?)',
      [
        localUser.id,
        item.title,
        item.dueAt || null,
        item.estimatedMinutes || null,
        'pending'
      ]
    );
  }
}

export async function toggleTaskStatus(taskId: number, currentStatus: string | null) {
  const db = await initDatabase();
  const isCompleted = COMPLETE_STATUSES.has((currentStatus ?? '').toLowerCase());
  const nextStatus = isCompleted ? 'pending' : 'completed';
  
  await db.runAsync('UPDATE tasks SET status = ? WHERE id = ?', [nextStatus, taskId]);
}

