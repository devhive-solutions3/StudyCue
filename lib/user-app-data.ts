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
  recurrence: string | null;
  eventType: string | null;
  specificDate: string | null;
};

export type TaskItem = {
  id: number;
  categoryId: number | null;
  title: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  status: string | null;
  createdAt: string | null;
};

export type TaskCategory = {
  id: number;
  name: string;
  slug: string;
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
  taskCategories: TaskCategory[];
  classes: ClassItem[];
  tasks: TaskItem[];
  sessions: StudySessionItem[];
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMPLETE_STATUSES = new Set(['completed', 'done']);

/** Values persisted to DB and read by Calendar EVENT_COLORS; unknown strings map to "class". */
const ALLOWED_CALENDAR_EVENT_TYPES = new Set([
  'class',
  'study',
  'quiz',
  'exam',
  'deadline',
  'review',
  'test',
]);

export function normalizeCalendarEventType(raw: string | undefined | null): string {
  const t = (raw ?? '').trim().toLowerCase();
  if (ALLOWED_CALENDAR_EVENT_TYPES.has(t)) return t;
  return 'class';
}

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeCategoryName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : 'General';
}

function slugifyCategoryName(raw: string): string {
  const normalized = normalizeCategoryName(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'general';
}

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

  const taskCategories = await db.getAllAsync<TaskCategory>(
    `SELECT id, name, slug
     FROM task_categories
     WHERE userId = ?
     ORDER BY name COLLATE NOCASE ASC`,
    [localUser.id]
  );

  const classes = await db.getAllAsync<ClassItem>(
    `SELECT id, title, weekday, startTime, endTime, location, recurrence, eventType, specificDate
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
    `SELECT id, categoryId, title, dueAt, estimatedMinutes, status, createdAt
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
    taskCategories,
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

/** Shown to Cue so the model can avoid duplicate or wrong-surface (calendar vs to-do) actions. */
export function formatCuePlanningContextForPrompt(snapshot: AppSnapshot): string {
  const now = new Date();
  const lines: string[] = [
    '=== USER DATA IN THIS APP (source of truth when deciding what already exists) ===',
    `Today's date (device local): ${getWeekdayName(now)}, ${formatLocalIsoDate(now)}`,
    'Calendar eventType values below: class | quiz | exam | deadline | study | review (app colors follow these types).',
  ];

  if (snapshot.classes.length === 0) {
    lines.push('Calendar: (no saved entries)');
  } else {
    lines.push(`Calendar (${snapshot.classes.length} saved):`);
    for (const c of snapshot.classes.slice(0, 35)) {
      if (!c.title?.trim()) continue;
      const when = [c.weekday, c.startTime, c.endTime].filter(Boolean).join(' ');
      lines.push(
        `- ${c.title.trim().slice(0, 72)} | ${when} | ${c.eventType || 'class'}${c.specificDate ? ` | ${c.specificDate}` : ''}`
      );
    }
    if (snapshot.classes.length > 35) {
      lines.push(`... +${snapshot.classes.length - 35} more calendar rows`);
    }
  }

  const pending = getPendingTasks(snapshot.tasks);
  if (snapshot.taskCategories.length > 0) {
    lines.push(`Task categories (${snapshot.taskCategories.length}):`);
    for (const c of snapshot.taskCategories.slice(0, 20)) {
      lines.push(`- ${c.name}`);
    }
  } else {
    lines.push('Task categories: (none yet)');
  }

  if (pending.length === 0) {
    lines.push('To-do (pending): (none)');
  } else {
    lines.push(`To-do (pending, ${pending.length}):`);
    for (const t of pending.slice(0, 30)) {
      if (!t.title?.trim()) continue;
      lines.push(`- ${t.title.trim().slice(0, 72)}`);
    }
  }

  lines.push(
    'Before emitting JSON: calendar rows must include the correct "eventType" (quiz/exam/study/review/deadline/class). For read-only questions about this schedule, answer in plain text—no JSON.'
  );

  return lines.join('\n');
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
  eventType?: string;
  recurrence?: string;
  specificDate?: string;
};

export async function recordStudySession(
  firebaseUser: User,
  sessionData: {
    taskId?: number | null;
    startedAt: string;
    endedAt: string;
    focusMinutes: number;
    completed: boolean;
  }
) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);
  await db.runAsync(
    'INSERT INTO study_sessions (userId, taskId, startedAt, endedAt, focusMinutes, completed, sessionType) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      localUser.id,
      sessionData.taskId || null,
      sessionData.startedAt,
      sessionData.endedAt,
      sessionData.focusMinutes,
      sessionData.completed ? 1 : 0,
      'focus',
    ]
  );
}

const ONE_TIME_EVENT_TYPES = new Set(['quiz', 'exam', 'deadline', 'study', 'review', 'test']);

export type AddParsedClassesResult = { inserted: number; skipped: number };

export async function addParsedClasses(
  firebaseUser: User,
  parsedClasses: ParsedClass[]
): Promise<AddParsedClassesResult> {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  let insertedCount = 0;
  let skippedMissingFields = 0;

  for (const item of parsedClasses) {
    if (!item.title || !item.weekday) {
      skippedMissingFields++;
      continue;
    }

    const eventType = normalizeCalendarEventType(item.eventType);
    // Smart default: classes are weekly, quizzes/exams/etc are one-time
    const recurrence = item.recurrence || (ONE_TIME_EVENT_TYPES.has(eventType) ? 'none' : 'weekly');

    await db.runAsync(
      'INSERT INTO classes (userId, title, weekday, startTime, endTime, location, eventType, recurrence, specificDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        localUser.id,
        item.title,
        item.weekday,
        item.startTime || null,
        item.endTime || null,
        item.location || null,
        eventType,
        recurrence,
        item.specificDate || null,
      ]
    );
    insertedCount++;
  }

  const result = { inserted: insertedCount, skipped: skippedMissingFields };

  // #region agent log
  const logPayload = {
    sessionId: '530b59',
    runId: 'post-fix',
    hypothesisId: 'H4',
    location: 'user-app-data.ts:addParsedClasses',
    message: 'calendar rows applied',
    data: {
      inputLen: parsedClasses.length,
      insertedCount,
      skippedMissingFields,
    },
    timestamp: Date.now(),
  };
  fetch('http://127.0.0.1:7870/ingest/d80afea3-449e-42fd-b7ab-6ca71d94c133', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '530b59' },
    body: JSON.stringify(logPayload),
  }).catch(() => {});
  if (__DEV__) {
    console.warn('[CueDebug]', JSON.stringify(logPayload));
  }
  // #endregion

  return result;
}

export async function updateClassItem(
  classId: number,
  updates: {
    title?: string;
    location?: string;
    recurrence?: string;
    eventType?: string;
    weekday?: string;
    startTime?: string;
    endTime?: string;
    specificDate?: string | null;
  }
) {
  const db = await initDatabase();
  const setClauses: string[] = [];
  const params: (string | number)[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.location !== undefined) {
    setClauses.push('location = ?');
    params.push(updates.location);
  }
  if (updates.recurrence !== undefined) {
    setClauses.push('recurrence = ?');
    params.push(updates.recurrence);
  }
  if (updates.eventType !== undefined) {
    setClauses.push('eventType = ?');
    params.push(updates.eventType);
  }
  if (updates.weekday !== undefined) {
    setClauses.push('weekday = ?');
    params.push(updates.weekday);
  }
  if (updates.startTime !== undefined) {
    setClauses.push('startTime = ?');
    params.push(updates.startTime);
  }
  if (updates.endTime !== undefined) {
    setClauses.push('endTime = ?');
    params.push(updates.endTime);
  }
  if (updates.specificDate !== undefined) {
    setClauses.push('specificDate = ?');
    params.push(updates.specificDate ?? '');
  }

  if (setClauses.length === 0) return;

  setClauses.push('updatedAt = CURRENT_TIMESTAMP');
  params.push(classId);

  await db.runAsync(
    `UPDATE classes SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );
}

export async function deleteClassItem(classId: number) {
  const db = await initDatabase();
  await db.runAsync('DELETE FROM classes WHERE id = ?', [classId]);
}

export async function clearAllClasses(firebaseUser: User) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  await db.runAsync('DELETE FROM classes WHERE userId = ?', [localUser.id]);
}

/**
 * Clears the user's study data while keeping account/profile identity intact.
 * Used by "Reset All Settings" on Profile.
 */
export async function resetUserStudyData(firebaseUser: User) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  await db.runAsync('DELETE FROM classes WHERE userId = ?', [localUser.id]);
  await db.runAsync('DELETE FROM tasks WHERE userId = ?', [localUser.id]);
  await db.runAsync('DELETE FROM study_sessions WHERE userId = ?', [localUser.id]);
}

export type ParsedTask = {
  title: string;
  dueAt?: string;
  estimatedMinutes?: number;
  category?: string;
};

export async function ensureTaskCategory(
  firebaseUser: User,
  categoryName: string
): Promise<TaskCategory> {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);
  const normalizedName = normalizeCategoryName(categoryName);
  const slug = slugifyCategoryName(normalizedName);

  const existing = await db.getFirstAsync<TaskCategory>(
    `SELECT id, name, slug
     FROM task_categories
     WHERE userId = ? AND slug = ?
     LIMIT 1`,
    [localUser.id, slug]
  );

  if (existing) {
    return existing;
  }

  const result = await db.runAsync(
    'INSERT INTO task_categories (userId, name, slug) VALUES (?, ?, ?)',
    [localUser.id, normalizedName, slug]
  );

  return {
    id: result.lastInsertRowId,
    name: normalizedName,
    slug,
  };
}

export async function addParsedTasks(firebaseUser: User, parsedTasks: ParsedTask[]) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);
  const categoryCache = new Map<string, TaskCategory>();

  let defaultCategory = await db.getFirstAsync<TaskCategory>(
    `SELECT id, name, slug
     FROM task_categories
     WHERE userId = ? AND slug = ?
     LIMIT 1`,
    [localUser.id, 'general']
  );
  if (!defaultCategory) {
    defaultCategory = await ensureTaskCategory(firebaseUser, 'General');
  }
  categoryCache.set(defaultCategory.slug, defaultCategory);

  let tasksInserted = 0;
  for (const item of parsedTasks) {
    if (!item.title) continue;

    const categoryName = item.category?.trim() ? item.category : defaultCategory.name;
    const categorySlug = slugifyCategoryName(categoryName);
    let category = categoryCache.get(categorySlug);
    if (!category) {
      category = await ensureTaskCategory(firebaseUser, categoryName);
      categoryCache.set(category.slug, category);
    }

    await db.runAsync(
      'INSERT INTO tasks (userId, categoryId, title, dueAt, estimatedMinutes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [
        localUser.id,
        category.id,
        item.title,
        item.dueAt || null,
        item.estimatedMinutes || null,
        'pending'
      ]
    );
    tasksInserted++;
  }

  // #region agent log
  const taskLogPayload = {
    sessionId: '530b59',
    runId: 'post-fix',
    hypothesisId: 'H1-H3',
    location: 'user-app-data.ts:addParsedTasks',
    message: 'todo rows applied',
    data: { inputLen: parsedTasks.length, tasksInserted },
    timestamp: Date.now(),
  };
  fetch('http://127.0.0.1:7870/ingest/d80afea3-449e-42fd-b7ab-6ca71d94c133', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '530b59' },
    body: JSON.stringify(taskLogPayload),
  }).catch(() => {});
  if (__DEV__) {
    console.warn('[CueDebug]', JSON.stringify(taskLogPayload));
  }
  // #endregion
}

export async function createTaskCategory(firebaseUser: User, categoryName: string): Promise<TaskCategory> {
  return ensureTaskCategory(firebaseUser, categoryName);
}

export async function addManualTask(
  firebaseUser: User,
  taskData: {
    title: string;
    estimatedMinutes?: number | null;
    dueAt?: string | null;
    categoryName?: string;
  }
) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);
  const category = await ensureTaskCategory(firebaseUser, taskData.categoryName || 'General');

  await db.runAsync(
    'INSERT INTO tasks (userId, categoryId, title, dueAt, estimatedMinutes, status) VALUES (?, ?, ?, ?, ?, ?)',
    [
      localUser.id,
      category.id,
      taskData.title.trim(),
      taskData.dueAt ?? null,
      taskData.estimatedMinutes ?? null,
      'pending',
    ]
  );
}

export async function toggleTaskStatus(taskId: number, currentStatus: string | null) {
  const db = await initDatabase();
  const isCompleted = COMPLETE_STATUSES.has((currentStatus ?? '').toLowerCase());
  const nextStatus = isCompleted ? 'pending' : 'completed';
  
  await db.runAsync('UPDATE tasks SET status = ? WHERE id = ?', [nextStatus, taskId]);
}

export async function reassignTaskCategory(
  taskId: number,
  categoryId: number | null
) {
  const db = await initDatabase();
  await db.runAsync(
    'UPDATE tasks SET categoryId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [categoryId, taskId]
  );
}

export type UserPreferences = {
  preferredFocusMinutes: number;
  preferredBreakMinutes: number;
  dailyGoalMinutes: number;
  energyMode: string;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredFocusMinutes: 25,
  preferredBreakMinutes: 5,
  dailyGoalMinutes: 120,
  energyMode: 'normal',
};

export async function loadUserPreferences(localUserId: number): Promise<UserPreferences> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{
    preferredFocusMinutes: number | null;
    preferredBreakMinutes: number | null;
    dailyGoalMinutes: number | null;
    energyMode: string | null;
  }>(
    'SELECT preferredFocusMinutes, preferredBreakMinutes, dailyGoalMinutes, energyMode FROM ai_preferences WHERE userId = ?',
    [localUserId]
  );

  if (!row) {
    return DEFAULT_PREFERENCES;
  }

  return {
    preferredFocusMinutes: row.preferredFocusMinutes ?? DEFAULT_PREFERENCES.preferredFocusMinutes,
    preferredBreakMinutes: row.preferredBreakMinutes ?? DEFAULT_PREFERENCES.preferredBreakMinutes,
    dailyGoalMinutes: row.dailyGoalMinutes ?? DEFAULT_PREFERENCES.dailyGoalMinutes,
    energyMode: row.energyMode ?? DEFAULT_PREFERENCES.energyMode,
  };
}

export async function updateUserProfile(
  firebaseUser: User,
  updates: {
    displayName?: string;
    preferredFocusMinutes?: number;
    dailyGoalMinutes?: number;
  }
) {
  const db = await initDatabase();
  const localUser = await ensureLocalUser(firebaseUser);

  if (updates.displayName !== undefined) {
    await db.runAsync(
      'UPDATE users_local SET displayName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [updates.displayName, localUser.id]
    );
  }

  if (updates.preferredFocusMinutes !== undefined || updates.dailyGoalMinutes !== undefined) {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM ai_preferences WHERE userId = ?',
      [localUser.id]
    );

    if (existing) {
      const setClauses: string[] = [];
      const params: (string | number)[] = [];

      if (updates.preferredFocusMinutes !== undefined) {
        setClauses.push('preferredFocusMinutes = ?');
        params.push(updates.preferredFocusMinutes);
      }
      if (updates.dailyGoalMinutes !== undefined) {
        setClauses.push('dailyGoalMinutes = ?');
        params.push(updates.dailyGoalMinutes);
      }
      setClauses.push('updatedAt = CURRENT_TIMESTAMP');
      params.push(localUser.id);

      await db.runAsync(
        `UPDATE ai_preferences SET ${setClauses.join(', ')} WHERE userId = ?`,
        params
      );
    } else {
      await db.runAsync(
        'INSERT INTO ai_preferences (userId, preferredFocusMinutes, dailyGoalMinutes) VALUES (?, ?, ?)',
        [
          localUser.id,
          updates.preferredFocusMinutes ?? DEFAULT_PREFERENCES.preferredFocusMinutes,
          updates.dailyGoalMinutes ?? DEFAULT_PREFERENCES.dailyGoalMinutes,
        ]
      );
    }
  }
}

export function computeStudyStreak(sessions: StudySessionItem[]): number {
  if (sessions.length === 0) return 0;

  const sessionDates = new Set<string>();
  for (const session of sessions) {
    if (session.startedAt) {
      const date = new Date(session.startedAt);
      if (!Number.isNaN(date.getTime())) {
        sessionDates.add(
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        );
      }
    }
  }

  if (sessionDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();
  const checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Check if today has a session; if not, start from yesterday
  const todayKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
  if (!sessionDates.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (sessionDates.has(key)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

